// Require Packages And Modules
const express = require("express");
const { app, IO, server } = require("./socket");
const path = require("path");
const PORT = 3000;

// SET MIDDLESWARES FOR FRONTEND
app.use(express.json({ limit: "1024MB" }));
app.use(express.urlencoded({ extended: true }));
// Serve static files from the public directory
app.use("../", express.static(path.join(__dirname, "../")));
app.use(express.static(path.join(__dirname, "../")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

server.listen(PORT, () => {
    console.clear();
    console.log("\n--------------------------------------------------+");
    console.log(`\n[+] Server Running On Port  -    ${PORT}             |`);
    console.log(`\n[+] Backend Developer - Ghs Julian                |\n`);
});
