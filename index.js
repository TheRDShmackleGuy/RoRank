require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());

// --- CONFIGURATION ---
const GROUP_ID = process.env.GROUP_ID;
const CLOUD_API_KEY = process.env.CLOUD_API_KEY;
const SECURITY_KEY = process.env.SECURITY_KEY;

// Your Rank Mapping (Must match your group role names exactly!)
const RANK_CONFIG = [
    { name: "Legend", min: 25000 },
    { name: "Mythic Hero", min: 15000 },
    { name: "Champion", min: 10000 },
    { name: "Warlord", min: 5000 },
    { name: "Tower Guardian", min: 2500 },
    { name: "Rocketeer", min: 1000 },
    { name: "Bombardier", min: 500 },
    { name: "Battler", min: 250 },
    { name: "Swordsman", min: 100 },
    { name: "Knight", min: 0 }
];

// --- HELPER FUNCTIONS ---

// Searches the group for a role name and returns its ID path (e.g., "groups/123/roles/456")
async function getRolePathByName(roleName) {
    try {
        const response = await axios.get(`https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/roles`, {
            headers: { 'x-api-key': CLOUD_API_KEY }
        });
        
        const roles = response.data.groupRoles;
        const found = roles.find(r => r.displayName.toLowerCase() === roleName.toLowerCase());
        
        return found ? found.path : null;
    } catch (error) {
        console.error("Error fetching group roles:", error.response?.data || error.message);
        return null;
    }
}

// --- ROUTES ---

// 1. WEB PAGE (For Uptime Robot and debugging)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. RANKING ENDPOINT (Called by Roblox)
app.post('/update-rank', async (req, res) => {
    const { userId, totalKOs, key } = req.body;

    // Security Check
    if (key !== SECURITY_KEY) {
        console.log(`Unauthorized request attempt for User ${userId}`);
        return res.status(403).json({ error: "Unauthorized" });
    }

    try {
        // Find the target rank based on KOs
        const targetRank = RANK_CONFIG.find(rank => totalKOs >= rank.min);
        
        if (!targetRank) {
            return res.status(400).json({ error: "No rank configuration found for this KO count." });
        }

        // Get the Role ID (Path) from Roblox
        const rolePath = await getRolePathByName(targetRank.name);
        
        if (!rolePath) {
            console.error(`Rank name "${targetRank.name}" not found in group roles!`);
            return res.status(404).json({ error: `Role '${targetRank.name}' not found in group.` });
        }

        // Assign the role to the user
        const assignUrl = `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships/users/${userId}:assignRole`;
        
        await axios.post(assignUrl, {
            role: rolePath
        }, {
            headers: {
                'x-api-key': CLOUD_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Successfully ranked User ${userId} to ${targetRank.name} (${totalKOs} KOs)`);
        res.json({ success: true, newRank: targetRank.name });

    } catch (error) {
        console.error("Ranking Process Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Internal Server Error during ranking." });
    }
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`-----------------------------------------`);
    console.log(`🚀 Bot is running on port ${PORT}`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🛠️ Group ID: ${GROUP_ID}`);
    console.log(`-----------------------------------------`);
});
