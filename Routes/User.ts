import express from "express";
import asyncHandler from "express-async-handler";
import pkg_pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const pool = new pkg_pg.Pool();
const router = express.Router();

router.post("/signupauth", asyncHandler(async (req, res) => {
    if (!req.body.email || !req.body.username || !req.body.password) {
        res.status(400).send("please insert valid data");
        return;
    }

    const usernameExists = await pool.query(`SELECT username FROM accounts WHERE username = '${req.body.username}'`);
    if(usernameExists.rows.length != 0) {
        res.status(400).send("username already exists");
        return;
    }

    const emailExists = await pool.query(`SELECT email FROM accounts WHERE email = '${req.body.email}'`);
    if(emailExists.rows.length != 0) {
        res.status(400).send("email already exists");
        return;
    }

    let password = await bcrypt.hash(req.body.password, 10);
    const db_response = await pool.query(`INSERT INTO accounts ("username", "email", "password", "created_on") VALUES('${req.body.username}', '${req.body.email}', '${password}', '${new Date().toISOString().substring(0,19)}')`)

    res.redirect("/user/loginauth");
}))

router.post("/loginauth", asyncHandler(async(req,res) => {
    if (!req.body.username || !req.body.password) {
        res.status(400).send("provide valid credentials");
        return;
    }
    let username = req.body.username;
    let { rows } = await pool.query(`SELECT username, email, password FROM accounts WHERE username = '${username}'`);
    
    if (rows.length == 0) {
        res.status(404).send("user not found, please provide with valid username");
        return;
    }

    let comparePassword = bcrypt.compareSync(req.body.password, rows[0].password);

    if (comparePassword != true) {
        res.status(404).send("wrong password");
        return;
    }

    let payload = {
        username: `${username}`
    }

    let secretKey: jwt.Secret = process.env.JWT_SECRET_KEY as unknown as jwt.Secret;
    let jwtToken = jwt.sign(payload, secretKey, {
        expiresIn: "30d"
    });
    res.status(200).json({token: jwtToken, username: username});
}))


export default router;
