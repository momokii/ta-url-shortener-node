const db = require('../db/db') // postgre
const statusCode = require('../utils/http-response').httpStatus_keyValue
const throw_err = require('../utils/throw-err')
const mongo = require('../db/mongo') // postgre
const MONGODB_NAME = process.env.MONGODB_NAME
const { ObjectId } = require('mongodb')

// * -------------------------------- FUNCTION

function generate_random_string(length) {
    // * rata rata random string short link 7-8 char
    const char = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomstr = ''
    for (let i = 0; i < length; i++) {
        randomstr += char.charAt(Math.floor(Math.random() * char.length))
    }

    return randomstr
}

// * -------------------------------- CONTROLLERS

// -- main function to USE ON END USER
exports.get_link_main = async (req, res, next) => {
    let db_select
    let mongoUrls // mongo
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const short_link = req.params.short_link 
        let url

        if(db_select === 'sql') {
            url = (await db.query('SELECT long_link, short_link, total_visited FROM urls WHERE short_link = $1', [short_link])).rows[0]
        
        } else {
            mongoUrls = mongo.db(MONGODB_NAME).collection('urls')

            url = (await mongoUrls.find({
                short_link: short_link
            }).project({long_link: 1, short_link:1, total_visited: 1}).toArray())[0]
        } 

        if(!url) throw_err('Link not found', statusCode['404_not_found'])
        
        const now = new Date()
        const total_visited = url.total_visited + 1

        if(db_select === 'sql') {
            await db.query('UPDATE urls SET total_visited = $1, last_visited = $2 WHERE short_link = $3', [total_visited, now, short_link])

        } else {
            await mongoUrls.updateOne({
                short_link: short_link
            }, {
                $set: {
                    total_visited: total_visited,
                    last_visited: now
                }
            })
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'short link found',
            data: {
                long_url: url.long_link,
                short_url: url.short_link
            }
        })
        
    } catch (e) {

        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    }
}



exports.get_all_links = async (req, res, next) => {
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const page = parseInt(req.query.page) || 1 
        const size = parseInt(req.query.per_page) || 10
        const offset = (page - 1) * size 
        const search = req.query.search || ''

        let links, total_links

        if(db_select === 'sql') {
            let query = 'SELECT a.id, a.user_id, b.username, b.name, b.role, b.is_active, a.long_link, a.short_link, a.last_visited, a.total_visited, a.created_at, a.updated_at FROM urls a left join users b on a.user_id = b.id where 1=1'

            if(search) query = query + ` and (short_link ilike '%${search}%' or long_link ilike '%${search}%')`

            links = await db.query(query)
            total_links = links.rowCount
            links = (links.rows).splice(offset, size)
            links = links.map(row => {
                return {
                    id: row.id,
                    user: {
                        id: row.user_id,
                        username: row.username,
                        name: row.name,
                        role: row.role,
                        is_active: row.is_active
                    },
                    long_link: row.long_link,
                    short_link: row.short_link,
                    last_visited: row.last_visited,
                    total_visited: row.total_visited,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                }
            })
        } else {
            const mongoUrls = mongo.db(MONGODB_NAME).collection('urls')
            const mongoUsers = mongo.db(MONGODB_NAME).collection('users')

            let query = {}
            if(search) {
                query.$or = [
                    {short_link: {$regex: search, $options: 'i'}},
                    {long_link: {$regex: search, $options: 'i'}}
                ]
            }

            links = await mongoUrls.find(query)
            .project({long_link: 1, short_link: 1, user_id: 1, last_visited: 1, total_visited: 1, created_at: 1, updated_at: 1})
            .toArray()

            total_links = links.length
            
            links = links.splice(offset, size)

            links = await Promise.all(links.map(async row => {
                let user = await mongoUsers.findOne({
                    _id: new ObjectId(row.user_id)
                }, {projection: {username: 1, name: 1, role: 1, is_active: 1}})

                return {
                    id: row._id,
                    user: {
                        id: row.user_id,
                        username: user.username,
                        name: user.name,
                        role: user.role,
                        is_active: user.is_active
                    },
                    long_link: row.long_link,
                    short_link: row.short_link,
                    last_visited: row.last_visited,
                    total_visited: row.total_visited,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                }
            }))
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'info link data',
            data: {
                page: page,
                per_page: size,
                total_data: total_links,
                links: links
            }
        })
        
    } catch (e) {
        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    }
}



exports.get_link_self = async (req, res, next) => {
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const page = parseInt(req.query.page) || 1 
        const size = parseInt(req.query.per_page) || 10
        const offset = (page - 1) * size 
        const search = req.query.search || ''

        let query, links, total_links

        if(db_select === 'sql') {
            query = `SELECT a.id, a.user_id, a.long_link, a.short_link, a.last_visited, a.total_visited, a.created_at, a.updated_at FROM urls a where 1=1 and user_id = ${req.userId}`

            if(search) query = query + ` and (short_link ilike '%${search}%' or long_link ilike '%${search}%')`
            
            links = await db.query(query)
            total_links = links.rowCount
            links = (links.rows).splice(offset, size)

        } else {
            const mongoUrls = mongo.db(MONGODB_NAME).collection('urls')
            
            query = {
                user_id: new ObjectId(req.userId)
            }
            if(search) {
                query.$or = [
                    {short_link: {$regex: search, $options: 'i'}},
                    {long_link: {$regex: search, $options: 'i'}}
                ]
            }

            links = await mongoUrls.find(query)
            .project({long_link: 1, short_link: 1, user_id: 1, last_visited: 1, total_visited: 1, created_at: 1, updated_at: 1})
            .toArray()
            total_links = links.length
            links = links.splice(offset, size)
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
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'info link data',
            data: {
                page: page,
                per_page: size,
                total_data: total_links,
                links: links
            }
        })
        
    } catch (e) {
        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    }
}



exports.get_one_link = async (req, res, next) => {
    let db_select
    let mongoUrls, mongoUsers, mongoUrlsHistory, userMongo
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'
        const url_id = req.params.id

        let url_data, url_history

        if(db_select === 'sql') {
            url_data = (await db.query('SELECT a.id, a.user_id, b.username, b.name, b.role, b.is_active, a.long_link, a.short_link, a.last_visited, a.total_visited, a.created_at, a.updated_at FROM urls a left join users b on a.user_id = b.id where a.id = $1', [url_id])).rows[0]

            if(!url_data) throw_err('Link not found', statusCode['404_not_found'])

        } else {
            mongoUrls = mongo.db(MONGODB_NAME).collection('urls')
            mongoUsers = mongo.db(MONGODB_NAME).collection('users')
            mongoUrlsHistory = mongo.db(MONGODB_NAME).collection('urls_history')

            url_data = (await mongoUrls.find({
                _id: new ObjectId(url_id)
            }).project({long_link: 1, short_link: 1, user_id: 1, last_visited: 1, total_visited: 1, created_at: 1, updated_at: 1}).toArray())[0]

            if(!url_data) throw_err('Link not found', statusCode['404_not_found'])

            userMongo = (await mongoUsers.find({
                _id: new ObjectId(url_data.user_id)
            }).project({username: 1, name: 1, role: 1, is_active: 1}).toArray())[0]

            url_data.username = userMongo.username
            url_data.name = userMongo.name
            url_data.role = userMongo.role
            url_data.is_active = userMongo.is_active
            url_data.id = url_id
            delete url_data._id
        }

        if(((url_data.user_id).toString() !== req.userId) && (req.role !== 1)) throw_err('You are not authorized to edit this link', statusCode['401_unauthorized'])


        if(db_select === 'sql') {
            url_history = (await db.query('SELECT id, url_id, long_link, short_link, user_id, total_visited, created_at FROM urls_history WHERE url_id = $1 order by created_at asc', [url_id])).rows

        } else {
            url_history = await mongoUrlsHistory.find({
                url_id: url_id
            }).project({long_link: 1, short_link: 1, user_id: 1, total_visited: 1, created_at: 1}).toArray()

            url_history = url_history.map(row => {
                return {
                    id: row._id,
                    long_link: row.long_link,
                    short_link: row.short_link,
                    user_id: row.user_id,
                    total_visited: row.total_visited,
                    created_at: row.created_at
                }
            })
        }

        url_data = {
            id: url_data.id,
            user: {
                id: url_data.user_id,
                username: url_data.username,
                name: url_data.name,
                role: url_data.role,
                is_active: url_data.is_active
            },
            long_link: url_data.long_link,
            short_link: url_data.short_link,
            last_visited: url_data.last_visited,
            total_visited: url_data.total_visited,
            created_at: url_data.created_at,
            updated_at: url_data.updated_at,
            history: url_history
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'get one link data', 
            data: url_data
        })
        
    } catch (e) {
        if(!e.statusCode){
            e.statusCode = statusCode['500_internal_server_error']
        }
        next(e)
    }
}



exports.create_link = async (req, res, next) => {
    let tx
    let session, mongoUrls // mongo
    let db_select
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const long_url = req.body.long_url
        const is_custom = req.body.custom_link === true ? true : false
        let short_url = req.body.short_url
        let is_short_link_exist

        if(db_select === 'sql') {
            tx = await db.connect()
            await tx.query('begin')
        } else {
            session = mongo.startSession()
            session.startTransaction()
            mongoUsers = mongo.db(MONGODB_NAME).collection('users')
            mongoUrls = mongo.db(MONGODB_NAME).collection('urls')
        }
        
        if(!is_custom) {
            // * create shorter link with random string and check if already exist in database
            let is_exist = true
            while(is_exist) {
                short_url = generate_random_string(7)

                if(db_select === 'sql') {
                    is_short_link_exist = (await tx.query('SELECT id, short_link FROM urls WHERE short_link = $1', [short_url])).rows[0]

                } else {
                    is_short_link_exist = await mongoUrls.findOne({
                        short_link: short_url
                    }, {session: session})
                }

                if(!is_short_link_exist) is_exist = false
            }
        } else {
            if(short_url.length < 5) throw_err('Custom link must be at least 5 characters', statusCode['400_bad_request'])

            if(db_select === 'sql') {
                is_short_link_exist = (await tx.query('SELECT id, short_link FROM urls WHERE short_link = $1', [short_url])).rows[0]
            } else {
                is_short_link_exist = await mongoUrls.findOne({
                    short_link: short_url
                }, {session: session})
            }

            if(is_short_link_exist) throw_err('Custom link already exist', statusCode['400_bad_request'])
        }

        if(db_select === 'sql') {
            await tx.query('INSERT INTO urls (long_link, short_link, user_id) VALUES ($1, $2, $3)', [long_url, short_url, req.userId])
            await tx.query('commit')

        } else {
            await mongoUrls.insertOne({
                long_link: long_url,
                short_link: short_url,
                user_id: new ObjectId(req.userId),
                total_visited: 0,
                last_visited: null,
                created_at: new Date(),
                updated_at: new Date()
            }, {session: session})

            await session.commitTransaction()
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'Successfully created short link',
            data: {
                long_url: long_url,
                short_url: short_url
            }
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



exports.edit_link = async (req, res, next) => {
    let tx
    let db_select
    let session, mongoUrls, mongoUrlsHistory // mongo
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const url_id = req.body.url_id
        const long_url = req.body.long_url
        const is_custom = req.body.custom_link === true ? true : false
        let short_url = req.body.short_url
        let is_short_link_exist

        let check_url

        // * check if url exist
        if(db_select === 'sql') {
            tx = await db.connect()
            await tx.query('begin')

            check_url = (await tx.query('select id, long_link, short_link, user_id, total_visited from urls where id = $1', [url_id])).rows[0]

        } else {
            session = mongo.startSession()
            mongoUrls = mongo.db(MONGODB_NAME).collection('urls')
            mongoUrlsHistory = mongo.db(MONGODB_NAME).collection('urls_history')
            session.startTransaction()

            check_url = (await mongoUrls.find({
                _id: new ObjectId(url_id)
            }, {session: session})
            .project({long_link: 1, short_link: 1, user_id: 1, total_visited: 1
            })
            .toArray())[0]
        }

        if(!check_url) throw_err('Link not found', statusCode['404_not_found'])

        if((check_url.user_id).toString() !== req.userId) throw_err('You are not authorized to edit this link', statusCode['401_unauthorized'])

        // * create shorter link with random string/custom and check if already exist in database
        if(!is_custom) {
            let is_exist = true
            while(is_exist) {
                short_url = generate_random_string(7)

                if(db_select === 'sql') {
                    is_short_link_exist = (await tx.query('SELECT id, short_link FROM urls WHERE short_link = $1', [short_url])).rows[0]

                } else {
                    is_short_link_exist = await mongoUrls.findOne({
                        short_link: short_url
                    }, {session: session})

                    if(is_short_link_exist) {
                        is_short_link_exist.id = (is_short_link_exist._id).toString()
                        delete is_short_link_exist._id
                    }
                }

                if(!is_short_link_exist || (is_short_link_exist.id === url_id)) is_exist = false // * pastikan short link tidak ada di database atau short link sama dengan short link sebelumnya
            }
        } else {
            if(short_url.length < 5) throw_err('Custom link must be at least 5 characters', statusCode['400_bad_request'])
            
            if(db_select === 'sql') {
                is_short_link_exist = (await tx.query('SELECT id, short_link FROM urls WHERE short_link = $1', [short_url])).rows[0]

            } else {
                is_short_link_exist = await mongoUrls.findOne({
                    short_link: short_url
                }, {session: session})

                if(is_short_link_exist) {
                    is_short_link_exist.id = (is_short_link_exist._id).toString()
                    delete is_short_link_exist._id
                }
            }

            if(is_short_link_exist) {
                if(is_short_link_exist.id !== url_id) throw_err('Custom link already exist', statusCode['400_bad_request'])
            } 
        }

        const time_now = new Date()
        const new_total_visited = 0

        // * update data and insert data lama ke url history
        if(db_select === 'sql') {
            await tx.query('UPDATE urls SET long_link = $1, short_link = $2, updated_at = $3, total_visited = $4 WHERE id = $5', [long_url, short_url, time_now, new_total_visited, url_id])

            // * insert data lama ke url history
            await tx.query('INSERT INTO urls_history (long_link, short_link, user_id, total_visited, url_id) VALUES ($1, $2, $3, $4, $5)', [check_url.long_link, check_url.short_link, req.userId, check_url.total_visited, url_id])

            await tx.query('commit')
        } else {
            await mongoUrls.updateOne({
                _id: new ObjectId(url_id)
            }, {
                $set: {
                    long_link: long_url,
                    short_link: short_url,
                    updated_at: time_now,
                    total_visited: new_total_visited
                }
            }, {session: session})

            await mongoUrlsHistory.insertOne({
                url_id: url_id,
                user_id: req.userId,
                long_link: check_url.long_link,
                short_link: check_url.short_link,
                total_visited: check_url.total_visited,
                created_at: time_now
            }, {session: session})

            await session.commitTransaction()
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'success update url data',
            data: {
                long_url: long_url,
                short_url: short_url
            }
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



exports.delete_link = async (req, res, next) => {
    let tx
    let db_select
    let session, mongoUrls, mongoUrlsHistory // mongo
    try{
        db_select = req.query.db || 'sql'
        db_select = db_select === 'sql' ? 'sql' : 'mongo'

        const url_id = req.body.url_id

        let check_url

        if(db_select === 'sql') {
            tx = await db.connect()
            await tx.query('begin')

            check_url = (await tx.query('select id, long_link, short_link, user_id, total_visited from urls where id = $1', [url_id])).rows[0]

        } else {
            session = mongo.startSession()
            mongoUrls = mongo.db(MONGODB_NAME).collection('urls')
            mongoUrlsHistory = mongo.db(MONGODB_NAME).collection('urls_history')
            session.startTransaction()

            check_url = await mongoUrls.findOne({
                _id: new ObjectId(url_id)
            }, {session: session})
        }

        if(!check_url) throw_err('Link not found', statusCode['404_not_found'])

        // * bisa delete adalah user pemilik/ user role admin
        if(((check_url.user_id).toString() !== req.userId) && (req.role !== 1)) throw_err('You are not authorized to edit this link', statusCode['401_unauthorized'])


        // * delete url and push url to history
        if(db_select === 'sql') {
            await tx.query('DELETE FROM urls WHERE id = $1', [url_id])

            await tx.query('INSERT INTO urls_history (long_link, short_link, user_id, total_visited, url_id) VALUES ($1, $2, $3, $4, $5)', [check_url.long_link, check_url.short_link, req.userId, check_url.total_visited, url_id])

            await tx.query('commit')

        } else {
            await mongoUrls.deleteOne({
                _id: new ObjectId(url_id)
            }, {session: session})

            await mongoUrlsHistory.insertOne({
                url_id: url_id,
                user_id: req.userId,
                long_link: check_url.long_link,
                short_link: check_url.short_link,
                total_visited: check_url.total_visited,
                created_at: new Date()
            }, {session: session})

            await session.commitTransaction()
        }

        res.status(statusCode['200_ok']).json({
            errors: false,
            message: 'success delete url data'
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