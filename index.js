const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const GROUP_ID = process.env.GROUP_ID;
const CLOUD_API_KEY = process.env.CLOUD_API_KEY;
const SECURITY_KEY = process.env.SECURITY_KEY;

// The exact names of your roles in your Roblox Group
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

// Helper to get Role ID by Name using Cloud API
async function getRoleIdByName(roleName) {
    try {
        const response = await axios.get(`https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/roles`, {
            headers: { 'x-api-key': CLOUD_API_KEY }
        });
        
        // Find role in the list returned by Roblox
        const foundRole = response.data.groupRoles.find(r => r.displayName === roleName);
        if (foundRole) {
            // Returns the full path: "groups/123/roles/456"
            return foundRole.path;
        }
        return null;
    } catch (error) {
        console.error("Error fetching roles:", error.response?.data || error.message);
        return null;
    }
}

app.post('/update-rank', async (req, res) => {
    const { userId, totalKOs, key } = req.body;
    if (key !== SECURITY_KEY) return res.status(403).send("Forbidden");

    try {
        // 1. Determine which rank name they should have based on KOs
        const targetConfig = RANK_CONFIG.find(r => totalKOs >= r.min);
        if (!targetConfig) return res.send("No rank found for this KO count");

        // 2. Fetch the Role Path (ID) for that name
        const rolePath = await getRoleIdByName(targetConfig.name);
        if (!rolePath) return res.status(404).send(`Role name '${targetConfig.name}' not found in group`);

        // 3. Assign the role via Cloud API
        const assignUrl = `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships/users/${userId}:assignRole`;
        await axios.post(assignUrl, {
            role: rolePath
        }, {
            headers: { 'x-api-key': CLOUD_API_KEY, 'Content-Type': 'application/json' }
        });

        console.log(`Successfully ranked User ${userId} to ${targetConfig.name}`);
        res.send({ success: true, rank: targetConfig.name });

    } catch (error) {
        console.error("Assign Role Error:", error.response?.data || error.message);
        res.status(500).send("API Error");
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Cloud Bot Online"));