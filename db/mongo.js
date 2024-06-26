const mongo = require('mongodb')

const client = new mongo.MongoClient(process.env.MONGODB_URI)

module.exports = client