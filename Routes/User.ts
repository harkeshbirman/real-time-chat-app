import express from "express";
import asyncHandler from "express-async-handler";
import pkg_pg from "pg";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";

const pool = new pkg_pg.Pool();
const router = express.Router();

/**
 * Signup for new users
 * @method POST 
 * @param {string} - route
 * @param {Function} - to be executed when the method on route is called
 * @returns {void}
 */
router.post("/signup", asyncHandler(async (req, res) => {

    // checks if all credentials are provided by the user
    if (!req.body.email || !req.body.username || !req.body.password) {
        res.status(400).send("please insert valid data");
        return;
    }

    // checks if username is already present in database
    const usernameExists = await pool.query(`SELECT username FROM accounts WHERE username = '${req.body.username}'`);
    if(usernameExists.rows.length != 0) {
        res.status(400).send("username already exists");
        return;
    }

    // checks for duplicate email
    const emailExists = await pool.query(`SELECT email FROM accounts WHERE email = '${req.body.email}'`);
    if(emailExists.rows.length != 0) {
        res.status(400).send("email already exists");
        return;
    }

    // creates new user
    let password = await bcrypt.hash(req.body.password, 10);
    const db_response = await pool.query(`INSERT INTO accounts ("username", "email", "password", "created_on") VALUES('${req.body.username}', '${req.body.email}', '${password}', '${new Date().toISOString().substring(0,19)}')`)

    res.redirect("/user/login");
}));

/**
 * Login for existing users
 * @method POST 
 * @param {string} - router path
 * @param {Function} - callback function
 * @returns {void}
 */
router.post("/login", asyncHandler(async(req,res) => {
    // check if all required credentials are provided by the user
    if (!req.body.username || !req.body.password) {
        res.status(400).send("provide valid credentials");
        return;
    }

    // check if the user exists in the database
    let username = req.body.username;
    let { rows } = await pool.query(`SELECT username, email, password FROM accounts WHERE username = '${username}'`);
    
    if (rows.length == 0) {
        res.status(404).send("user not found, please provide with valid username");
        return;
    }
    
    // comparing the original password with hashed password
    let comparePassword = bcrypt.compareSync(req.body.password, rows[0].password);

    if (comparePassword != true) {
        res.status(404).send("wrong password");
        return;
    }

    // creating json web token
    let payload = {
        username: `${username}`
    }

    let secretKey: jwt.Secret = process.env.JWT_SECRET_KEY as unknown as jwt.Secret;
    let jwtToken = jwt.sign(payload, secretKey, {
        expiresIn: "30d"
    });
    res.status(200).json({token: jwtToken, username: username});
}))

/**
 * Find chats for given users 
 * @method GET 
 * @param {string} - route path
 * @param {Function} - callback function
 * @returns {void}
 */
router.get("/chat/", asyncHandler(async(req, res) => {
    const otherUser = req.query.other;
    const jwtToken = req.headers['authorization']?.split(' ')[1];

    // check for valid json web token
    if (!jwtToken) {
        res.status(404).send('invalid authorization token');
        return;
    }

    
    let me = '';
    
    try {
        const secretKey = process.env.JWT_SECRET_KEY as unknown as jwt.Secret;
        me = (jwt.verify(jwtToken, secretKey) as unknown as JwtPayload).username;
    } catch(err) {
        res.status(400).send('authentication error');
    }

    // extract chat between two user if second user is present 
    if (otherUser) {
        const messageQuery = await pool.query(`SELECT sender, receiver, message, sent_at FROM messages WHERE sender = '${me}' and receiver = '${otherUser}' or sender = '${otherUser}' and receiver = '${me}' order by sent_at`);
        
        const messages = messageQuery.rows;
        res.status(200).send(messages);
    } else { 
        // extracts all the previous users who chatted with the account owner
        const messageQuery = await pool.query(`SELECT distinct receiver as otherUser FROM messages WHERE sender = '${me}'
        UNION 
        SELECT distinct sender as otherUser FROM messages WHERE receiver = '${me}'`);
        const messages = messageQuery.rows;
        res.status(200).send(messages);
    }

    return;
}))


export default router;
