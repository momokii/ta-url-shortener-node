const router = require('express').Router()
const urlController = require('../controllers/urlController')
const is_admin = require('../middlewares/role-checking').is_admin
const is_auth = require('../middlewares/is-auth')
const statusCode = require('../utils/http-response').httpStatus_keyValue
const throw_err = require('../utils/throw-err')
const db = require('../db/db') // postgre

// * -------------------------------- routing

router.get('/', is_auth, is_admin, urlController.get_all_links)

router.get('/self', is_auth, urlController.get_link_self)

router.get('/:id', is_auth, urlController.get_one_link)

router.post('/', is_auth, urlController.create_link)

router.patch('/', is_auth, urlController.edit_link)

router.delete('/', is_auth, urlController.delete_link)



module.exports = router