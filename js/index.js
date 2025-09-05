const uploadContainer = document.querySelector(".upload-container");
const nameContainer = document.querySelector(".name-container");
const downloadContainer = document.querySelector(".download-container");
const fileInput = document.querySelector("#files");
const msg = document.querySelector("#msg");
const progress = document.querySelector(".progress");
const progressLayer = progress.querySelector("#layer");
const progressSize = progress.querySelector("#progress-size");

const receivedProgress = document.querySelector(
    ".download-container .progress"
);
const recievedProgressLayer = receivedProgress.querySelector("#layer");
const receivedProgressSize = receivedProgress.querySelector("#progress-size");

const upload = document.querySelector(".upload");
const selectBox = document.querySelector(".upload-container select");
const viewFileBtn = document.querySelector(".download-container .view");
const downloadBtn = document.querySelector(".download-container .download");

let FILE = null;
let socket;
let RECEIVER = "";
let RECEIVED_CHUNKS = [];
let receivedFileName = "";
let receivedFileType = "";
let totalFileSize = 0;
let receivedFileSize = 0;

// Suppose you already have an ArrayBuffer called "arrayBuffer"
const arrayBufferToFile = (arrayBuffer, fileName, mimeType) => {
    // Convert ArrayBuffer to a typed array
    const uint8Array = new Uint8Array(arrayBuffer);
    // Create a Blob from the typed array
    const blob = new Blob([uint8Array], { type: mimeType });
    // Convert Blob to File (if you need a File object instead of Blob)
    return new File([blob], fileName, { type: mimeType });
};

// Create Download File System
const createDownload = (file, type, name, size, total_size) => {
    uploadContainer.style.display = "none";
    downloadContainer.style.display = "flex";
    document.querySelector(".download-container #f-name").textContent = name;
    document.querySelector(".download-container #f-type").textContent = type;
    document.querySelector(".download-container #f-size").textContent =
        getFileSize(size) + " / " + getFileSize(total_size);

    // Set Download
    downloadBtn.download = name;
    downloadBtn.href = URL.createObjectURL(file);
};

// Create Socket Connection
const createSocketConnection = name => {
    localStorage.setItem("uploader-name", name.toLowerCase());
    socket = io("http://localhost:3000", {
        auth: { name: name.toLowerCase() }
    });

    socket.on("connect", () => {
        console.log("Socket connected");
    });

    socket.on("clients", clients => {
        // selectBox.innerHTML = ""; // Clear existing options
        const myName = localStorage.getItem("uploader-name");
        clients.forEach(client => {
            if (client + "j" !== myName) {
                const option = document.createElement("option");
                option.value = client;
                option.textContent = client;
                selectBox.appendChild(option);
            }
        });
    });

    socket.on("disconnect", () => {
        console.log("[-] Client Disconnected From Server");
    });

    socket.on("connect_error", err => {
        console.error("[!] Connection failed:", err.message);
    });

    // Listen for incoming chunks
    socket.on("get-chunk", chunk => {
        // Here you can handle saving or reconstructing the file
        RECEIVED_CHUNKS.push(new Uint8Array(chunk.chunk));
        receivedFileName = chunk.name;
        totalFileSize = chunk.size;
        receivedFileType = chunk.type;
        receivedFileSize = chunk.offset;
        let file = new File([chunk.chunk], receivedFileName, {
            type: receivedFileType
        });
        createDownload(
            file,
            receivedFileType,
            receivedFileName,
            receivedFileSize,
            totalFileSize
        );
        viewFileBtn.style.display = "none";
        downloadBtn.style.display = "none";
        receivedProgress.style.display = "flex";
        recievedProgressLayer.style.width = chunk.count + "%";
        receivedProgressSize.textContent = "Please Wait " + chunk.count + "%";
        receivedProgressSize.style.color =
            chunk.count > 50 ? "#ffffff" : "#000000";
    });

    // If Uploaded Complete And All Chunks Received
    socket.on("upload-complete", data => {
        if (data.uploaded) {
            let totalLength = RECEIVED_CHUNKS.reduce(
                (acc, curr) => acc + curr.length,
                0
            );

            // Merge into one Uint8Array
            let mergedArray = new Uint8Array(totalLength);
            let offset = 0;
            for (let chunk of RECEIVED_CHUNKS) {
                mergedArray.set(chunk, offset);
                offset += chunk.length;
            }

            // Create Blob/File
            const file = new File([mergedArray], receivedFileName, {
                type: receivedFileType
            });
            createDownload(
                file,
                receivedFileType,
                receivedFileName,
                receivedFileSize,
                totalFileSize
            );
            viewFileBtn.style.display = "block";
            downloadBtn.style.display = "block";
            receivedProgress.style.display = "none";
            recievedProgressLayer.style.width = "0";
            receivedProgressSize.textContent = "0";
        }
    });
};

// Get Unique Name From User
document.querySelector(".enter").onclick = () => {
    const name = document.querySelector("#name").value.trim();
    if (!name) return;
    let uniqeName = name.replace(/\s+/g, "");
    createSocketConnection(uniqeName);
    nameContainer.style.display = "none";
    uploadContainer.style.display = "flex";
};

// Show Message
const showMsg = (type, message) => {
    msg.className = type ? "success" : "error";
    msg.textContent = message;
    setTimeout(() => {
        msg.removeAttribute("class");
        msg.textContent = "";
    }, 2500);
};

// Get File Size
const getFileSize = bytes => {
    if (bytes === 0) return "0 Bytes";
    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + " " + units[i];
};

// File Input Change
fileInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return showMsg(false, "No file selected");
    FILE = file;
});

// Select Receiver
selectBox.addEventListener("change", e => {
    RECEIVER = e.target.value;
});

// Upload File
upload.onclick = async () => {
    if (!FILE) return showMsg(false, "No file selected");
    if (!RECEIVER) return showMsg(false, "Please select a receiver");

    progress.style.display = "flex";
    upload.style.display = "none";
    const chunkSize = 1024 * 512; // 512 KB per chunk
    let offset = 0;
    let count = 1;

    while (offset < FILE.size) {
        const chunk = FILE.slice(offset, offset + chunkSize);
        const buffer = await chunk.arrayBuffer();
        const percent =
            Math.min(Math.round((offset / FILE.size) * 100), 100) + 1;

        socket.emit("upload-chunk", {
            receiver: RECEIVER,
            name: FILE.name,
            size: FILE.size,
            type: FILE.type,
            offset,
            count: percent,
            chunk: new Uint8Array(buffer)
        });

        offset += chunkSize;
        // Update progress
        progressLayer.style.width = percent + "%";
        progressSize.textContent = "Please Wait " + percent + "%";
        progressSize.style.color = percent > 50 ? "#ffffff" : "#000000";
    }

    showMsg(true, "File Sent Successfully!");
    socket.emit("upload-complete", {
        total_chunks: offset,
        uploaded: true,
        receiver: RECEIVER
    });
    progressLayer.style.width = "0";
    progress.style.display = "none";
    upload.style.display = "block";
};

// Close Download Option
viewFileBtn.onclick = () => {
    uploadContainer.style.display = "flex";
    downloadContainer.style.display = "none";
    progressLayer.style.width = "0";
    progress.style.display = "none";
    FILE = null;
    RECEIVED_CHUNKS = [];
    receivedFileName = "";
    receivedFileType = "";
    receivedFileSize = 0;
};

// Auto-connect if name exists
window.onload = () => {
    const name = localStorage.getItem("uploader-name");
    if (name) {
        createSocketConnection(name);
        nameContainer.style.display = "none";
        uploadContainer.style.display = "flex";
    } else {
        nameContainer.style.display = "flex";
        uploadContainer.style.display = "none";
    }
};
