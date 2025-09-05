const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const IO = new Server(server, {
    cors: {
        origin: "*"
    }
});

const clients = {};

// Middleware to handle handshake authentication
IO.use((socket, next) => {
    const token = socket.handshake.auth.name; // custom token
    if (token) {
        return next();
    } else {
        console.log("Handshake failed for:", socket.id);
        return next(new Error("Authentication error"));
    }
});

IO.on("connection", socket => {
    const name = socket.handshake.auth.name;
    console.log(`\n[+] Client Connected - ${name}\n`);
    clients[name] = socket.id;

    // Send updated clients list
    IO.emit("clients", Object.keys(clients));

    // IF CHUNK IS COMING FROM UPLOADER
    socket.on("upload-chunk", chunk => {
        const receiverSocketId = clients[chunk.receiver];
        if (receiverSocketId) {
            IO.to(receiverSocketId).emit("get-chunk", chunk);
        } else {
            console.log(`Receiver ${chunk.receiver} not found`);
        }
    });
    
    // IF FILE UPLOADED COMPLETE 
    socket.on("upload-complete",(data)=>{
        const receiverSocketId = clients[data.receiver];
        if (receiverSocketId) {
            IO.to(receiverSocketId).emit("upload-complete", data);
        } else {
            console.log(`Receiver ${data.receiver} not found`);
        }
    })

    // If Client Disconnected
    socket.on("disconnect", () => {
        console.log(`\n[-] Client Disconnected - ${name}\n`);
        delete clients[name];
        IO.emit("clients", Object.keys(clients));
    });
});

module.exports = { app, IO, server };

