const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const chokidar = require("chokidar");
const { exec } = require('child_process');
const os = require("os");

const PORT = 3000;
const HOST = "localhost";

// Helper function to determine content type
const getContentType = (filePath) => {
    const ext = path.extname(filePath);
    switch (ext) {
        case ".html": return "text/html";
        case ".css": return "text/css";
        case ".js": return "application/javascript";
        case ".json": return "application/json";
        case ".jpg": return "image/jpg";
        case ".jpeg": return "image/jpeg";
        case ".png": return "image/png";
        case ".gif": return "image/gif";
        default: return "text/plain";
    }
};

// WebSocket script to inject
const liveReloadScript = `
    <!-- Code injected by NodeJs custom webserver -->
    <script>
        const socket = new WebSocket(\`ws://\${location.host}\`);
        socket.onmessage = (event) => {
            if (event.data === "reload") {
                console.log("File change detected. Reloading page...");
                window.location.reload();
            }
        };
    </script>
`;

// Create the HTTP server
const server = http.createServer((req, res) => {
    const baseDir = path.join(__dirname, "public");
    let filePath = path.join(baseDir, req.url === "/" ? "index.html" : req.url);
    filePath = path.normalize(filePath);

    fs.exists(filePath, (exists) => {
        if (!exists) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            return res.end("404 Not Found");
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500, { "Content-Type": "text/plain" });
                return res.end("Internal Server Error");
            }

            const contentType = getContentType(filePath);
            if (contentType === "text/html") {
                // Inject the live-reload script into the HTML
                content = content.toString().replace(
                    "</body>",
                    `${liveReloadScript}</body>`
                );
            }

            res.writeHead(200, { "Content-Type": contentType });
            res.end(content);
        });
    });
});

// Start the server
server.listen(PORT, HOST, () => {
    console.log(`Server is running at http://${HOST}:${PORT}/`);

    // Open in default browser
    switch (os.type()) {
        case "Linux": 
            exec(`xdg-open http://${HOST}:${PORT}`); 
            break;
        case "Darwin": 
            exec(`open http://${HOST}:${PORT}`); 
            break;
        case "Windows_NT":
            exec(`start http://${HOST}:${PORT}`);
            break;
    }
    
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Watch for file changes in the "public" folder
const watcher = chokidar.watch(path.join(__dirname, "public"), {
    ignoreInitial: true,
});

// Notify all clients on file change
watcher.on("change", (filePath) => {
    console.log(`File changed: ${filePath}`);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send("reload");
        }
    });
});
