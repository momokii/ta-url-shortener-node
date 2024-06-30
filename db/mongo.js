const mongo = require('mongodb')

const client = new mongo.MongoClient(process.env.MONGODB_URI, {
    maxConnecting: 100,
})

module.exports = client