import express from 'express';
import 'dotenv/config';
import pkg_pg, { Connection } from 'pg';
import { Server, Socket } from 'socket.io';
import jwt from "jsonwebtoken";
import cookieParser from 'cookie-parser';

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

/**
 * @method GET
 * @returns {string} - welcomes who visit "/" path
 */
app.get("/", (req,res) => {
    res.send("welcome to my chat-app");
})

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

/**
 * socket authenticator
 * @param {Socket} socket - the connection request
 * @param {Function} next - the callback function
 */
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

// maps socketid to name
let socketidName: { [char: string]: string } = {};
// maps name to socketid
let nameSocketid: { [char: string]: string } = {};

io.on('connection', (socket: Socket) => {

    // broadcasts the name of everyone who joins the chat
    const name = socket.data.username;
    console.log(`${name} with ${socket.id} connected!`);
    nameSocketid[name] = socket.id;
    socketidName[socket.id] = name;
    socket.broadcast.emit('new-user-joined', { from: name, message: `${name} joined` })

    // Handle private messages
    socket.on('private message', (data: { to: string; message: string }) => {
        const { to, message } = data;
        socket.to(nameSocketid[to]).emit('private message', { from: socketidName[socket.id], message });
        const sender = socket.data.username;
        const sent_at = new Date().toISOString().substring(0,19);
        pool.query(`INSERT INTO messages (sender, receiver, message, sent_at) VALUES ('${sender}', '${to}', '${message}', '${sent_at}')`)
    });

    // fires the disconnection event
    socket.on('disconnect', () => {
        console.log(`${socket.id} disconnected!`);
        let name = socketidName[socket.id];
        socket.broadcast.emit("disconnected", name);
        delete socketidName[socket.id];
        delete nameSocketid[name];
    });
});



export { }

