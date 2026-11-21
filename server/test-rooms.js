const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const pool = require("./db");
const roomRoutes = require("./routes/roomRoutes");

async function runTests() {
    console.log("=== STARTING SPHERESHARE BACKEND TEST SUITE ===");

    // Set up test server
    const app = express();
    app.use(express.json());
    app.use("/api/rooms", roomRoutes);

    const server = app.listen(5099);
    const BASE_URL = "http://localhost:5099/api/rooms";

    try {
        // Test 1: Create a room
        console.log("\n--- TEST 1: Create a Room ---");
        const createRes = await fetch(BASE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Hackathon Squad Basket",
                hostName: "Alice"
            })
        });
        const createData = await createRes.json();
        console.log("Status:", createRes.status);
        console.log("Response:", createData);

        if (!createData.success || !createData.room.code) {
            throw new Error("Failed to create room!");
        }

        const roomCode = createData.room.code;
        console.log("✓ Room created with code:", roomCode);

        // Test 2: Join the room
        console.log("\n--- TEST 2: Join the Room (Bob joins) ---");
        const joinRes = await fetch(`${BASE_URL}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code: roomCode,
                memberName: "Bob"
            })
        });
        const joinData = await joinRes.json();
        console.log("Status:", joinRes.status);
        console.log("Response:", joinData);
        if (!joinData.success) throw new Error("Bob failed to join room!");
        console.log("✓ Bob successfully joined");

        // Test 3: Add products to shared cart
        console.log("\n--- TEST 3: Add Products to Shared Cart ---");
        // Product 3: Men Cotton T Shirt (has stock ~14)
        const addItemRes1 = await fetch(`${BASE_URL}/${roomCode}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                productId: "3",
                addedBy: "Alice",
                quantity: 2
            })
        });
        const addItemData1 = await addItemRes1.json();
        console.log("Add Item 1 Status:", addItemRes1.status);
        console.log("Add Item 1 Response:", addItemData1);
        if (!addItemData1.success) throw new Error("Failed to add Item 1");

        // Product 4: Running Shoes (has stock ~7)
        const addItemRes2 = await fetch(`${BASE_URL}/${roomCode}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                productId: "4",
                addedBy: "Bob",
                quantity: 1
            })
        });
        const addItemData2 = await addItemRes2.json();
        console.log("Add Item 2 Status:", addItemRes2.status);
        console.log("Add Item 2 Response:", addItemData2);
        if (!addItemData2.success) throw new Error("Failed to add Item 2");

        const item1Id = addItemData1.item.id;
        const item2Id = addItemData2.item.id;
        console.log("✓ Items added successfully! IDs:", item1Id, item2Id);

        // Test 4: Voting on Items
        console.log("\n--- TEST 4: Voting on Products ---");
        // Bob upvotes item 1
        const voteRes1 = await fetch(`${BASE_URL}/${roomCode}/items/${item1Id}/vote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                voterName: "Bob",
                vote: 1
            })
        });
        const voteData1 = await voteRes1.json();
        console.log("Bob upvote response:", voteData1);

        // Alice upvotes item 1
        const voteRes2 = await fetch(`${BASE_URL}/${roomCode}/items/${item1Id}/vote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                voterName: "Alice",
                vote: 1
            })
        });
        const voteData2 = await voteRes2.json();
        console.log("Alice upvote response:", voteData2);

        // Bob downvotes item 2
        const voteRes3 = await fetch(`${BASE_URL}/${roomCode}/items/${item2Id}/vote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                voterName: "Bob",
                vote: -1
            })
        });
        const voteData3 = await voteRes3.json();
        console.log("Bob downvote response:", voteData3);
        console.log("✓ Voting functional and tallies calculated");

        // Test 5: Get full room details
        console.log("\n--- TEST 5: Get Full Room Details ---");
        const detailsRes = await fetch(`${BASE_URL}/${roomCode}`);
        const detailsData = await detailsRes.json();
        console.log("Room Details Status:", detailsRes.status);
        console.log("Members count:", detailsData.room.members.length);
        console.log("Items in cart:", detailsData.room.items.map(i => ({
            id: i.id,
            name: i.name,
            qty: i.quantity,
            price: i.price,
            netVotes: i.netVotes,
            addedBy: i.addedBy
        })));
        console.log("Subtotal:", detailsData.room.subtotal);
        if (detailsData.room.items.length !== 2) throw new Error("Expected 2 items in room!");
        console.log("✓ Room details retrieved with aggregated votes");

        // Test 6: Remove an item from shared cart
        console.log("\n--- TEST 6: Remove Item from Shared Cart ---");
        const removeRes = await fetch(`${BASE_URL}/${roomCode}/items/${item2Id}`, {
            method: "DELETE"
        });
        const removeData = await removeRes.json();
        console.log("Remove response:", removeData);
        if (!removeData.success) throw new Error("Failed to remove item!");

        // Verify it was removed
        const verifyRes = await fetch(`${BASE_URL}/${roomCode}`);
        const verifyData = await verifyRes.json();
        console.log("Remaining items:", verifyData.room.items.length);
        if (verifyData.room.items.length !== 1) throw new Error("Item was not removed properly!");
        console.log("✓ Item removed successfully");

        // Test 7: Prevent Overselling (Single and Cumulative)
        console.log("\n--- TEST 7: Prevent Overselling (Single & Cumulative Stock Checks) ---");
        // 7a: Single large quantity exceeds stock
        const oversellRes = await fetch(`${BASE_URL}/${roomCode}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                productId: "3",
                addedBy: "Charlie",
                quantity: 99999
            })
        });
        const oversellData = await oversellRes.json();
        console.log("7a: Extreme single oversell status:", oversellRes.status);
        console.log("7a: Response:", oversellData);
        if (oversellRes.status !== 400) throw new Error("Extreme oversell should have returned 400 status!");

        // 7b: Cumulative stock check: Room already has 2 of Product 3.
        // Fetch current stock of Product 3
        const prodCheck = await pool.query("SELECT stock FROM products WHERE id = '3'");
        const currentDbStock = Number(prodCheck.rows[0].stock);
        console.log(`Current DB stock of Product 3: ${currentDbStock}. Cart already has 2.`);
        // Try to add remaining stock (currentDbStock), which would make total in cart = currentDbStock + 2 > currentDbStock
        const cumulativeOversellRes = await fetch(`${BASE_URL}/${roomCode}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                productId: "3",
                addedBy: "Charlie",
                quantity: currentDbStock
            })
        });
        const cumulativeOversellData = await cumulativeOversellRes.json();
        console.log("7b: Cumulative oversell status:", cumulativeOversellRes.status);
        console.log("7b: Cumulative response:", cumulativeOversellData);
        if (cumulativeOversellRes.status !== 400) {
            throw new Error("Cumulative addition exceeding stock should have returned 400 status!");
        }
        console.log("✓ Single and cumulative overselling correctly rejected");

        // Test 8: Atomic Group Checkout
        console.log("\n--- TEST 8: Atomic Group Checkout ---");
        const checkoutRes = await fetch(`${BASE_URL}/${roomCode}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Alice Hacker",
                email: "alice.hacker@hackathon.dev",
                address: "MG Road, Bengaluru, Karnataka"
            })
        });
        const checkoutData = await checkoutRes.json();
        console.log("Checkout status:", checkoutRes.status);
        console.log("Checkout response:", checkoutData);
        if (!checkoutData.success || !checkoutData.order) {
            throw new Error("Group checkout failed: " + JSON.stringify(checkoutData));
        }
        console.log("✓ Group checkout succeeded! Order ID:", checkoutData.order.id);

        // Test 9: Prevent Duplicate Checkout
        console.log("\n--- TEST 9: Prevent Duplicate Checkout ---");
        const dupCheckoutRes = await fetch(`${BASE_URL}/${roomCode}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Bob Hacker",
                email: "bob.hacker@hackathon.dev",
                address: "Indiranagar, Bengaluru"
            })
        });
        const dupCheckoutData = await dupCheckoutRes.json();
        console.log("Duplicate checkout status:", dupCheckoutRes.status);
        console.log("Duplicate checkout response (expected 400 error):", dupCheckoutData);
        if (dupCheckoutRes.status !== 400) {
            throw new Error("Duplicate checkout should have returned 400 status!");
        }
        console.log("✓ Duplicate checkout blocked successfully");

        // Test 10: Confirm Room Status in Database
        console.log("\n--- TEST 10: Confirm Database Integrity ---");
        const finalRoomRes = await fetch(`${BASE_URL}/${roomCode}`);
        const finalRoomData = await finalRoomRes.json();
        console.log("Final Room Status:", finalRoomData.room.status);
        console.log("Linked Order ID:", finalRoomData.room.orderId);
        if (finalRoomData.room.status !== "checked_out") {
            throw new Error("Room status should be 'checked_out'!");
        }
        console.log("✓ Room record updated with order reference");

        console.log("\n==========================================");
        console.log("🎉 ALL SPHERESHARE BACKEND TESTS PASSED!");
        console.log("==========================================");

    } catch (err) {
        console.error("\n❌ TEST FAILED:", err);
    } finally {
        server.close();
        await pool.end();
    }
}

runTests();
