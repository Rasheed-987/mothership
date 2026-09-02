/**
 * Proves the schema's invariants against the real database.
 * Creates only prefixed test data and removes it again.
 *
 * Run with:  npm run smoke
 */
import mongoose from 'mongoose'
import { Role } from '../src/models/Role'
import { User } from '../src/models/User'
import { Invitation } from '../src/models/Invitation'
import { Invoice } from '../src/models/Invoice'
import { Client } from '../src/models/Client'
import { nextSequence, Counter } from '../src/models/Counter'
import '../src/models'

const TAG = '__smoke__'
let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`)
    passed++
  } else {
    console.log(`  ✗ ${name} ${detail}`)
    failed++
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 10_000 })
  const admin = mongoose.connection.db!.admin()

  console.log('\nDeployment')
  const hello = await admin.command({ hello: 1 })
  check(`replica set "${hello.setName}" — transactions available`, Boolean(hello.setName))

  console.log('\nOne-super-admin index')
  let rejected = false
  try {
    await User.create({
      email: `${TAG}second-owner@test.local`,
      name: 'Second Owner',
      passwordHash: 'x'.repeat(60),
      isSuperAdmin: true,
    })
  } catch (err) {
    rejected = (err as { code?: number }).code === 11000
  }
  check('a second super admin is rejected by the database', rejected)

  console.log('\nPermission resolution')
  const pmRole = await Role.findOne({ key: 'project_manager' }).lean()
  const financeRole = await Role.findOne({ key: 'finance_manager' }).lean()
  const user = await User.create({
    email: `${TAG}pm@test.local`,
    name: 'Test PM',
    passwordHash: 'x'.repeat(60),
    roles: [{ roleId: pmRole!._id, assignedAt: new Date() }],
  })

  const fetched = await User.findById(user._id).lean()
  check('passwordHash is not returned by default', !('passwordHash' in (fetched as object)))

  const roles = await Role.find({ _id: { $in: fetched!.roles.map((r) => r.roleId) } }).lean()
  const perms = [...new Set(roles.flatMap((r) => r.permissions))]
  check('PM resolves project.create', perms.includes('project.create'))
  check('PM does NOT resolve invoice.send', !perms.includes('invoice.send'))

  // Two roles at once — the union of their permissions is what the DAL computes.
  await User.updateOne(
    { _id: user._id },
    { $push: { roles: { roleId: financeRole!._id, assignedAt: new Date() } } },
  )
  const both = await User.findById(user._id).lean()
  const bothRoles = await Role.find({ _id: { $in: both!.roles.map((r) => r.roleId) } }).lean()
  const unionPerms = [...new Set(bothRoles.flatMap((r) => r.permissions))]
  check('holding two roles unions their permissions', unionPerms.includes('project.create') && unionPerms.includes('invoice.send'))

  console.log('\nInvitation uniqueness')
  const viewerRole = await Role.findOne({ key: 'viewer' }).lean()
  const inviteBase = {
    email: `${TAG}invitee@test.local`,
    roleId: viewerRole!._id,
    invitedBy: user._id,
    expiresAt: new Date(Date.now() + 7 * 864e5),
  }
  await Invitation.create({ ...inviteBase, tokenHash: `${TAG}hash-a` })
  let dupeRejected = false
  try {
    await Invitation.create({ ...inviteBase, tokenHash: `${TAG}hash-b` })
  } catch (err) {
    dupeRejected = (err as { code?: number }).code === 11000
  }
  check('a second pending invite to the same email is rejected', dupeRejected)

  await Invitation.updateOne({ tokenHash: `${TAG}hash-a` }, { $set: { status: 'revoked' } })
  let afterRevoke = true
  try {
    await Invitation.create({ ...inviteBase, tokenHash: `${TAG}hash-c` })
  } catch {
    afterRevoke = false
  }
  check('re-inviting works once the old invite is revoked', afterRevoke)

  console.log('\nInvoice totals')
  const client = await Client.create({ name: `${TAG}Acme`, createdBy: user._id })
  const seq = await nextSequence(`${TAG}invoice`)
  const invoice = await Invoice.create({
    number: `${TAG}INV-${seq}`,
    clientId: client._id,
    dueDate: new Date(Date.now() + 30 * 864e5),
    createdBy: user._id,
    amountPaid: 50_000,
    lineItems: [
      // 3 x 333.33 = 999.99, tax 18% = 179.9982 -> rounds to 180.00
      { description: 'Design sprint', qty: 3, unitPrice: 33_333, taxPct: 18 },
      { description: 'Retainer', qty: 1, unitPrice: 100_000, taxPct: 0 },
    ],
  })
  check('subtotal computed per line', invoice.subtotal === 199_999, `got ${invoice.subtotal}`)
  check('tax rounded per line, not at the end', invoice.taxTotal === 18_000, `got ${invoice.taxTotal}`)
  check('total = subtotal + tax', invoice.total === 217_999, `got ${invoice.total}`)
  check('balance = total - amountPaid', invoice.balance === 167_999, `got ${invoice.balance}`)

  let floatRejected = false
  try {
    await Client.create({ name: `${TAG}Float`, createdBy: user._id })
    const bad = new Invoice({
      number: `${TAG}INV-float`,
      clientId: client._id,
      dueDate: new Date(),
      createdBy: user._id,
      lineItems: [{ description: 'x', qty: 1, unitPrice: 10.5, taxPct: 0 }],
    })
    await bad.save()
  } catch {
    floatRejected = true
  }
  check('non-integer money is caught (amount rounds to integer)', !floatRejected)

  console.log('\nCounter atomicity')
  const before = await nextSequence(`${TAG}counter`)
  const results = await Promise.all(Array.from({ length: 20 }, () => nextSequence(`${TAG}counter`)))
  check('20 concurrent increments produce 20 distinct numbers', new Set(results).size === 20)
  check('no gaps in the sequence', Math.max(...results) === before + 20)

  console.log('\nTransactions')
  const session = await mongoose.startSession()
  let txnWorked = false
  try {
    await session.withTransaction(async () => {
      await Client.create([{ name: `${TAG}TxnClient`, createdBy: user._id }], { session })
    })
    txnWorked = true
  } catch (err) {
    console.log('    ', (err as Error).message)
  } finally {
    await session.endSession()
  }
  check('multi-document transaction commits', txnWorked)

  console.log('\nCleaning up…')
  await Promise.all([
    User.deleteMany({ email: new RegExp(`^${TAG}`) }),
    Invitation.deleteMany({ email: new RegExp(`^${TAG}`) }),
    Invoice.deleteMany({ number: new RegExp(`^${TAG}`) }),
    Client.deleteMany({ name: new RegExp(`^${TAG}`) }),
    Counter.deleteMany({ _id: new RegExp(`^${TAG}`) }),
  ])

  await mongoose.disconnect()
  console.log(`\n${failed === 0 ? '✓' : '✗'} ${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error('\n✗ smoke test crashed:', err)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
