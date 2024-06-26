const router = require('express').Router()
const userController = require('../controllers/userController')
const { body }  = require('express-validator')
const is_admin = require('../middlewares/role-checking').is_admin
const is_auth = require('../middlewares/is-auth')
const statusCode = require('../utils/http-response').httpStatus_keyValue
const throw_err = require('../utils/throw-err')
const db = require('../db/db') // postgre
const MONGODB_NAME = process.env.MONGODB_NAME
const mongo = require('../db/mongo')

// * -------------------------------- routing
router.get('/', is_auth, is_admin, userController.get_all_user)

router.get('/self', is_auth, userController.check_self)

router.get('/:username', is_auth, is_admin, userController.get_user_by_username)

router.post('/', is_auth, is_admin, [
    body('username', 'Username is used, try using another username and username must be alphanumeric')
        .isAlphanumeric()
        .isLength({min: 5})
        .custom((value, {req}) => {
            return (async () => {
                let db_select, user
    
                db_select = req.query.db || 'sql'
                db_select = db_select === 'sql' ? 'sql' : 'mongo'

                if(db_select === 'sql') {
                    user = (await db.query('SELECT id, username FROM users WHERE username = $1', [value])).rows[0]

                } else {
                    const mongodb = mongo.db(MONGODB_NAME).collection('users')
                    user = await mongodb.findOne({
                        username: value
                    })

                }
                if(user){
                    throw_err(
                        "Username is used, try using another username",
                        statusCode['401_unauthorized'] )
                }
            })()
        }),
    body('password', "Password atleast using 1 number and 1 uppercase with minimum length 6 character")
        .isStrongPassword({
            minLength: 6,
            minNumbers: 1,
            minUppercase: 1,
            minSymbols: 0
        })
], userController.create_user)

router.patch('/', is_auth, userController.change_data)

router.patch('/password', is_auth, [
    body('new_password', "Password atleast using 1 number and 1 uppercase with minimum length 6 character")
        .isStrongPassword({
            minLength: 6,
            minNumbers: 1,
            minUppercase: 1,
            minSymbols: 0
        })
], userController.change_password)

router.patch('/status', is_auth, is_admin, userController.change_status)

router.delete('/delete', is_auth, is_admin, userController.delete_user)



module.exports = router