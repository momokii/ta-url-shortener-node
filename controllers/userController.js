const mongo = require('../db/mongo') // postgre
const MONGODB_NAME = process.env.MONGODB_NAME
const { ObjectId } = require('mongodb')
const db = require('../db/db') // postgre
const statusCode = require('../utils/http-response').httpStatus_keyValue
const throw_err = require('../utils/throw-err')
const { validationResult }  = require('express-validator')
const bcrypt = require('bcrypt')

// * -------------------------------- CONTROLLERS

exports.check_self = async (req, res, next) => {
    try{

        delete req.user.password

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'get self data',
            data: req.user
        })

    } catch(e) {
        if(!e.statusCode) {
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(exports)
    }
}



exports.get_all_user = async (req, res, next) => {
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const page = parseInt(req.query.page) || 1 
        const size = parseInt(req.query.per_page) || 10
        const offset = (page - 1) * size 
        const search = req.query.search || ''
        const user_type = req.query.user_type || ''
        let is_active = req.query.is_active || ''
        if((is_active === '1') || (is_active === '')) is_active = true
        else is_active = false
        
        let query, user, total_user

        if(db_select === 'sql') {
            query = 'SELECT id, username, name, role, is_active FROM users where 1=1'

            if(search) query = query + ` and (username ilike '%${search}%' or name ilike '%${search}%')`
            if(user_type) query = query + ` and role = '${user_type}'`
            
            query = query + ` and is_active = ${is_active}`
            
            user = await db.query(query)
            total_user = user.rowCount
            user = (user.rows).splice(offset, size)

        } else {
            let query = {
                is_active: is_active
            }

            if (search) {
                query.$or = [
                    { username: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } }
                ]
            }
            
            if (user_type) query.role = parseInt(user_type)
            
            const mongoUsers = mongo.db(MONGODB_NAME).collection('users')
    
            total_user = await mongoUsers.countDocuments(query)

            user = await mongoUsers.find(query)
            .project({ username: 1, name: 1, role: 1, is_active: 1 })
            .skip(offset)
            .limit(size)
            .toArray()
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message : "Info user detail",
            data: {
                page: page,
                per_page: size,
                total_data: total_user,
                users: user
            }
        })
        
    } catch (e) {
        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    }
}



exports.get_user_by_username = async (req, res, next) => {
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'
        const username = req.params.username
        let user, links

        if(db_select === 'sql') {
            user = (await db.query('SELECT id, username, name, role, is_active FROM users WHERE username = $1', [username])).rows[0]

            if(!user) throw_err("User not found", statusCode['404_not_found'])

            links = await db.query('SELECT id, long_link, short_link, user_id, last_visited, total_visited, created_at, updated_at FROM urls WHERE user_id = $1', [user.id])

            user.links = links.rows
            
        } else {
            const mongoUsers = mongo.db(MONGODB_NAME).collection('users')
            const mongoUrls = mongo.db(MONGODB_NAME).collection('urls')
            user = (await mongoUsers.find({
                username: username
            }).project({username: 1, name: 1, role: 1, is_active: 1}).toArray())[0]

            if(!user) throw_err("User not found", statusCode['404_not_found'])

            links = await mongoUrls.find({
                user_id: new ObjectId(user._id)
            })
            .project({long_link: 1, short_link: 1, user_id: 1, last_visited: 1, total_visited: 1, created_at: 1, updated_at: 1})
            .toArray()
            links = links.map(row => {
                return {
                    id: row._id,
                    long_link: row.long_link,
                    short_link: row.short_link,
                    user_id: row.user_id,
                    last_visited: row.last_visited,
                    total_visited: row.total_visited,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                }
            })

            user.id = user._id 
            delete user._id
            user.links = links
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'Info User',
            data: user
        })
        
    } catch (e) {
        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    }
}



exports.create_user = async (req, res, next) => {
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const err_val = validationResult(req)
        if(!err_val.isEmpty()){
            const err_view = err_val.array()[0].msg
            const err = new Error('Add new user Failed - ' + err_view)
            err.statusCode = statusCode['400_bad_request']
            throw err
        }

        const username = req.body.username
        const password = req.body.password
        const hash_password = await bcrypt.hash(password, 16)
        const name = req.body.name
        const role = req.body.role || 2 // 1 admin 2 user

        if(db_select === 'sql') {
            await db.query('insert into users (username, password, name, role, is_active) values ($1, $2, $3, $4, $5)', [username, hash_password, name, role, true])

        } else {
            const mongoUsers = mongo.db(MONGODB_NAME).collection('users')

            const date_now = new Date()

            const new_user = {
                username,
                password: hash_password,
                name,
                role,
                is_active: true,
                created_at: date_now,
                updated_at: date_now
            }

            await mongoUsers.insertOne(new_user)
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'Success create new account'
        })
        
    } catch (e) {
        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    }
}



exports.change_password = async (req, res, next) => {
    let tx // postgre
    let session, mongoUsers // mongo
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const val_err = validationResult(req)
        if(!val_err.isEmpty()){
            const msg = val_err.array()[0].msg
            throw_err(msg, statusCode['400_bad_request'])
        }

        const compare_oldpass = await bcrypt.compare(req.body.password_now, req.user.password)
        if(!compare_oldpass) throw_err("Older password is wrong", statusCode['400_bad_request'])
        
        const new_pass = await bcrypt.hash(req.body.new_password, 16)

        if(db_select === 'sql') {
            tx = await db.connect()
            await tx.query('begin')

            await tx.query('UPDATE users SET password = $1 WHERE id = $2', [new_pass, req.userId])
            
            await tx.query('commit')
            
        } else {
            session = mongo.startSession()
            mongoUsers = mongo.db(MONGODB_NAME).collection('users')
            session.startTransaction()

            await mongoUsers.updateOne({
                _id: new ObjectId(req.userId)
            }, {
                $set: { password: new_pass }
            }, {session: session})
            await session.commitTransaction()
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: "User success change password"
        })

    } catch (e) {
        if(tx) await tx.query('rollback')
        else if(session) await session.abortTransaction()

        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    } finally {
        if(tx) tx.release()
        else if(session) await session.endSession()
    }
}



exports.change_data = async (req, res, next) => {
    let tx // postgre
    let session, mongoUsers // mongo
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        let user_id, user

        if(req.role === 1) user_id = req.body.user_id
        else user_id = req.userId

        const new_name = req.body.name
        const new_role = req.body.role 

        if((new_role) && (req.role !== 1)) throw_err('just admin can change role', statusCode['401_unauthorized'])

        if(db_select === 'sql') {
            tx = await db.connect()
            await tx.query('begin')

            user = (await tx.query('SELECT id, username, is_active FROM users WHERE id = $1', [user_id])).rows[0]

        } else {
            session = mongo.startSession()
            mongoUsers = mongo.db(MONGODB_NAME).collection('users')

            session.startTransaction()

            user = (await mongoUsers.find({
                _id: new ObjectId(user_id)
            }, {session: session})
            .project({username: 1})
            .toArray())[0]
        }
        
        if(!user) throw_err('User not found', statusCode['401_unauthorized'])
        if((req.role === 1) && ((user._id).toString() === req.userId) && (new_role)) throw_err('Admin can not change self role data', statusCode['401_unauthorized'])

        if(db_select === 'sql') {
            let data = [new_name]
            let paramIndex = 1
            let query = `UPDATE users set name = $${paramIndex}`

            if(new_role) {
                paramIndex++
                query += `, role = $${paramIndex}`
                data.push(new_role)
            }

            paramIndex++
            query += ` WHERE id = $${paramIndex}`
            data.push(user_id)

            await tx.query(query, data)
            await tx.query('commit')
        } else {
            let data = {
                name: new_name
            }

            if(new_role) data.role = new_role

            await mongoUsers.updateOne({
                _id: new ObjectId(user_id)
            }, {
                $set: data
            }, {session: session})

            await session.commitTransaction()
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'success change user data'
        })
        
    } catch (e) {
        if(tx) await tx.query('rollback')
        else if(session) await session.abortTransaction()

        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    } finally {
        if(tx) tx.release()
        else if(session) await session.endSession()
    }
}



exports.change_status = async (req, res, next) => {
    let tx // postgre
    let session, mongoUsers// mongo
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const user_id = req.body.user_id

        let user

        if(db_select === 'sql') {
            tx = await db.connect()
            await tx.query('begin')

            user = (await tx.query('SELECT id, username, is_active FROM users WHERE id = $1', [user_id])).rows[0]
        } else {
            session = mongo.startSession()
            mongoUsers = mongo.db(MONGODB_NAME).collection('users')

            session.startTransaction()

            user = (await mongoUsers.find({
                _id: new ObjectId(user_id)
            }, {session: session})
            .project({username: 1, name: 1, role: 1, is_active: 1 })
            .toArray())[0]
        }
        
        
        if(!user) throw_err('User not found', statusCode['401_unauthorized'])

        if(user_id === req.userId) throw_err("Can't do self change active status", statusCode['400_bad_request'])

        user.is_active = user.is_active ? false : true

        if(db_select === 'sql') {
            await tx.query('UPDATE users set is_active = $1 WHERE id = $2 ', [user.is_active, user_id])
            await tx.query('commit')

        } else {
            await mongoUsers.updateOne({
                _id: new ObjectId(user_id)
            }, { $set: { is_active: user.is_active }}, {session: session})

            await session.commitTransaction()
        }
        
        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'success change status user'
        })
        
    } catch (e) {
        if(tx) await tx.query('rollback')
        else if(session) await session.abortTransaction()

        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    } finally {
        if(tx) tx.release()
        else if(session) await session.endSession()
    }
}



exports.delete_user = async (req, res, next) => {
    let tx // postgre
    let session, mongoUsers, mongoUrls, mongoUrlsHistory // mongo
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const user_id = req.body.user_id

        let check_user, links_user

        if(db_select === 'sql') {
            tx = await db.connect()
            await tx.query('begin')

            check_user = (await tx.query('SELECT id, username FROM users WHERE id = $1', [user_id])).rows[0]

        } else {
            session = mongo.startSession()
            mongoUsers = mongo.db(MONGODB_NAME).collection('users')
            mongoUrls = mongo.db(MONGODB_NAME).collection('urls')
            mongoUrlsHistory = mongo.db(MONGODB_NAME).collection('urls_history')

            session.startTransaction()

            check_user = (await mongoUsers.find({
                _id: new ObjectId(user_id)
            }, {session: session})
            .project({username: 1})
            .toArray())[0]
        }
        
        if(!check_user) throw_err("User not found", statusCode['404_not_found'])

        if(user_id === req.userId) throw_err("Can't do self delete", statusCode['400_bad_request'])
        
        if(db_select === 'sql') {
            links_user = (await tx.query('SELECT id, long_link, short_link, user_id, total_visited FROM urls WHERE user_id = $1', [user_id])).rows

            links_user.forEach(async link => {
                await tx.query('INSERT INTO urls_history (long_link, short_link, user_id, total_visited, url_id) VALUES ($1, $2, $3, $4, $5)', [link.long_link, link.short_link, link.user_id, link.total_visited, link.id])
            })

            await tx.query('DELETE FROM urls WHERE user_id = $1', [user_id])

            await tx.query('DELETE FROM users WHERE id = $1', [user_id])

            await tx.query('commit')
        } else {
            links_user = await mongoUrls.find({
                user_id: new ObjectId(user_id)
            }, {session: session})
            .project({ long_link: 1, short_link: 1, user_id: 1, total_visited: 1 })
            .toArray()

            const now = new Date()

            await Promise.all(links_user.map(async link => {
                    await mongoUrlsHistory.insertOne({
                        long_link: link.long_link,
                        short_link: link.short_link,
                        user_id: (link.user_id).toString(),
                        total_visited: link.total_visited,
                        url_id: (link._id).toString(), 
                        created_at: now,
                        updated_at: now
                    }, { session: session })
            }))

            await mongoUrls.deleteMany({
                user_id: new ObjectId(user_id)
            }, {session: session})

            await mongoUsers.deleteOne({
                _id: new ObjectId(user_id)
            }, {session: session})

            await session.commitTransaction()
        }
        
        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'success delete user'
        })
        
    } catch (e) {
        if(tx) await tx.query('rollback')
        else if(session) await session.abortTransaction()

        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    } finally {
        if(tx) tx.release()
        else if(session) await session.endSession()
    }
}