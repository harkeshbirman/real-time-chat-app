import express from 'express';
import 'dotenv/config';
import pkg_pg from 'pg';
import { Server, Socket } from 'socket.io';
import jwt from "jsonwebtoken";
import cookieParser from 'cookie-parser';
import path from 'path';

import userRoute from './Routes/User';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const server = app.listen(8080, () => {
    console.log("listening on port: 8080");
});

const { Pool } = pkg_pg;
const pool = new Pool();

app.use("/user/", userRoute);

app.get("/", (req,res) => {
    res.sendFile(path.resolve(`${__dirname}/../static/index.html`));
})

app.get("/favicon", (_,res) => {
    res.sendFile(path.resolve(`${__dirname}/../static/favicon.png`));
})

app.get("/authenticate", async (req,res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const secretKey = process.env.JWT_SECRET_KEY;
    
    const result = jwt.verify(token as string, secretKey as unknown as jwt.Secret);
    if (!result) {
        res.status(400).json({message: 'invalid token'});
    }

    const user = await pool.query(`SELECT username, email FROM accounts WHERE username = '${(result as unknown as jwt.JwtPayload).username}'`);
    res.status(200).send(user.rows);
})


const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.get("/login", (req,res) => {
    res.sendFile(`${__dirname}/static/index.html`)
})


io.use(async(socket, next) => {
    const jwtToken = socket.handshake.auth.token;
    if (!jwtToken) {
        console.log('jwt token not present');
    } else {
        try {
            let secretKey = process.env.JWT_SECRET_KEY as unknown as string;
            const userInfo = jwt.verify(jwtToken, secretKey) as unknown as jwt.JwtPayload;
            socket.data.username = userInfo.username;
            next();
        } catch(err) {
            console.log((err as Error).message);
        }
    }
})

let useridName: { [char: string]: string } = {};
let nameUserid: { [char: string]: string } = {};

io.on('connection', (socket: Socket) => {

    // broadcasts the name of everyone who joins the chat
    const name = socket.data.username;
    console.log(`${name} with ${socket.id} connected!`);
    nameUserid[name] = socket.id;
    useridName[socket.id] = name;
    socket.broadcast.emit('new-user-joined', { from: name, message: `${name} joined` })
    // console.log(useridName, nameUserid);

    // Handle private messages
    socket.on('private message', (data: { to: string; message: string }) => {
        const { to, message } = data;
        socket.to(nameUserid[to]).emit('private message', { from: useridName[socket.id], message });
    });

    // fires the disconnection event
    socket.on('disconnect', () => {
        console.log(`${socket.id} disconnected!`);
        let name = useridName[socket.id];
        socket.broadcast.emit("disconnected", name);
        delete useridName[socket.id];
        delete nameUserid[name];
    });
});







export { }

