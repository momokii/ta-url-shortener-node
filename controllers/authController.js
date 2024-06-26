const mongo = require('../db/mongo')
const MONGODB_NAME = process.env.MONGODB_NAME
const db = require('../db/db') // postgre
const statusCode = require('../utils/http-response').httpStatus_keyValue
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const throw_err = require('../utils/throw-err')

// * -------------------------------- CONTROLLERS

exports.login = async (req, res, next) => {
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const username = req.body.username
        const password = req.body.password
        let user, user_id

        
        if(db_select === 'mongo'){
            const mongodb = mongo.db(MONGODB_NAME).collection('users')
            user = await mongodb.findOne({
                username: username
            })

            if(!user) throw_err('Wrong Username / Password', statusCode['400_bad_request'])

            user_id = user._id

        } else {
            user = (await db.query('SELECT id, username, name, password, role, is_active FROM users WHERE username = $1', [username])).rows[0]

            user_id = user.id

            if(!user) throw_err('Wrong Username / Password', statusCode['400_bad_request'])

        }

        const check_pass = await bcrypt.compare(password, user.password)
        if(!check_pass) throw_err("Wrong Username / Password", statusCode['400_bad_request'])

        if(!user.is_active) throw_err("Your account is not active", statusCode['401_unauthorized'])
        
        // * jwt just contain userId with 30days expired time
        const access_token = jwt.sign({
            userId: user_id // use mongo // use postgre & make sure for mongo data
        }, process.env.JWT_SECRET, {
            expiresIn: '30d'
        })

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'Login Success',
            data: {
                access_token : access_token,
                token_type: 'Bearer',
                expired_time: '30d'
            }
        })
        
    } catch (e) {
        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    }
}