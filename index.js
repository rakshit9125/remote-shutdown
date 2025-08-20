const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");

// Serve static files from public folder
app.use(express.static(__dirname));
app.use(cors());

let pcs = {};
// pcs = { PCNAME: { shutdown: false, lastSeen: Date.now(), shutdownUntil: 0 } }

// Cleanup function to remove expired shutdown commands and offline PCs
function cleanup() {
  const now = Date.now();
  for (const [pc, info] of Object.entries(pcs)) {
    // Clear expired shutdown commands
    if (info.shutdown && now > info.shutdownUntil) {
      info.shutdown = false;
      info.shutdownUntil = 0;
    }
    // Remove PCs that haven't reported in for more than 1 minute
    if (now - info.lastSeen > 60 * 1000) {
      delete pcs[pc];
    }
  }
}
// Run cleanup every 30 seconds
setInterval(cleanup, 30000);

// Report PC online
app.get("/report", (req, res) => {
  const pc = req.query.pc;
  if (pc) {
    if (!pcs[pc]) {
      pcs[pc] = { shutdown: false, lastSeen: Date.now(), shutdownUntil: 0 };
    } else {
      pcs[pc].lastSeen = Date.now();
      // Don't clear shutdown command here - let it be consumed by the command endpoint
    }
    res.json(pcs[pc]);
  } else {
    res.json({ error: "no pc" });
  }
});

// List active PCs
app.get("/list", (req, res) => {
  const now = Date.now();
  const onlinePCs = {};
  for (const [pc, info] of Object.entries(pcs)) {
    if (now - info.lastSeen < 30 * 1000) {
      onlinePCs[pc] = info;
    }
  }
  res.json(onlinePCs);
});

// Request shutdown
app.post("/shutdown", (req, res) => {
  const pc = req.query.pc;
  console.log(`Shutdown request received for PC: ${pc}`);
  console.log(`Current PCs:`, pcs);
  if (pc && pcs[pc]) {
    pcs[pc].shutdown = true;
    pcs[pc].shutdownUntil = Date.now() + 15000; // shutdown valid for 15s
    console.log(
      `Shutdown command set for ${pc}, valid until: ${new Date(pcs[pc].shutdownUntil)}`,
    );
    res.send("Shutdown command sent to " + pc);
  } else {
    console.log(`PC ${pc} not found in active PCs`);
    res.send("PC not found");
  }
});

// Client checks for command
app.get("/command", (req, res) => {
  const pc = req.query.pc;
  const now = Date.now();
  console.log(`Command check for PC: ${pc}`);
  console.log(`PC info:`, pcs[pc]);
  if (pcs[pc] && pcs[pc].shutdown && now < pcs[pc].shutdownUntil) {
    console.log(`Sending shutdown command to ${pc}`);
    pcs[pc].shutdown = false; // consume command once
    res.send("shutdown");
  } else {
    console.log(`No shutdown command for ${pc}`);
    res.send("ok");
  }
});

// Root endpoint serves the HTML file from public automatically because of express.static
app.listen(process.env.PORT || 3000, () => console.log("Server running"));
