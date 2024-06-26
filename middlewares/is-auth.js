const jwt = require('jsonwebtoken')
const statusCode = require('../utils/http-response').httpStatus_keyValue
const db = require('../db/db') // postgre
const mongo = require('../db/mongo')
const { ObjectId } = require('mongodb')
const MONGODB_NAME = process.env.MONGODB_NAME
const throw_err = require('../utils/throw-err')

module.exports = async (req, res, next) => {
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        let user
        
        const authHeader = req.get('Authorization')
        if(!authHeader){
            throw_err('Need Header Auth', statusCode['401_unauthorized'])
        }

        const token = authHeader.split(' ')[1]

        const decode_token = jwt.verify(token, process.env.JWT_SECRET)
        if(!decode_token){
            throw_err('Token Not Valid', statusCode['401_unauthorized'])
        }

        if(db_select === 'mongo') {
            const mongodb = mongo.db(MONGODB_NAME).collection('users')
            user = (await mongodb.find({
                _id: new ObjectId(decode_token.userId)
            }).project({username: 1, name: 1, role: 1, is_active: 1, password: 1 }).toArray())[0]

            if(!user) throw_err('Token Not Valid', statusCode['401_unauthorized'])

            user.id = user._id 
            delete user._id

        } else {
            user = (await db.query('SELECT id, username, name, password, role, is_active FROM users WHERE id = $1', [decode_token.userId])).rows[0]

            if(!user) throw_err('Token Not Valid', statusCode['401_unauthorized'])
        }

        if(!user.is_active) throw_err('Your account is not active', statusCode['401_unauthorized'])

        req.userId = decode_token.userId
        req.role = user.role
        req.user = user

        next()
    } catch (e) {
        if(!e.statusCode) {
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    }
}