import bcrypt from 'bcrypt'

const password = 'Toohey123'
const hash = await bcrypt.hash(password, 10)
console.log('Generated hash:', hash)
const match = await bcrypt.compare(password, hash)
console.log('Test match:', match)
