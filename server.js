require('dotenv').config();
const express = require('express');
const cors = require('cors');
const oracledb = require('oracledb');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Oracle DB configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECTION_STRING
};

// Helper function to execute a query
async function executeQuery(sql) {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows;
    } catch (err) {
        console.error("Database Error:", err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Error closing connection:", err);
            }
        }
    }
}

// ==========================================
// RAW TABLE ENDPOINTS
// ==========================================
const tables = ['PATIENT', 'DOCTOR', 'DOCTOR_PHONENUM', 'NURSE', 'NURSE_PHONENUM', 'ROOM', 'MEDICINE', 'COMPANION'];

tables.forEach(table => {
    if (table === 'COMPANION') {
        // Special: JOIN with PATIENT to show patient name
        app.get(`/api/tables/companion`, async (req, res) => {
            try {
                const sql = `SELECT P.Name AS "Patient_Name", C.Name AS "Companion_Name", C.Relationship, C.Contact_Num
                             FROM COMPANION C JOIN PATIENT P ON C.P_ID = P.ID`;
                const data = await executeQuery(sql);
                res.json({ success: true, data });
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        });
    } else {
        app.get(`/api/tables/${table.toLowerCase()}`, async (req, res) => {
            try {
                const data = await executeQuery(`SELECT * FROM ${table}`);
                res.json({ success: true, data });
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        });
    }
});

// ==========================================
// COMPLEX QUERIES ENDPOINTS
// ==========================================

// Query 1 (JOIN Operation)
app.get('/api/query1', async (req, res) => {
    const sql = `
        SELECT P.Name AS "Patient_Name", R.Room_Type AS "Room_Type"
        FROM PATIENT P 
        JOIN ROOM R ON P.P_Room_num = R.Room_Num
    `;
    try {
        const data = await executeQuery(sql);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Query 2 (UNION Operation): All phone numbers with owner names
app.get('/api/query2', async (req, res) => {
    const sql = `
        SELECT D.Name AS "Owner_Name", DP.D_PhoneNum AS "Phone_Number", 'Doctor' AS "Role"
        FROM DOCTOR D JOIN DOCTOR_PhoneNum DP ON D.ID = DP.ID
        UNION
        SELECT N.Name AS "Owner_Name", NP.N_PhoneNum AS "Phone_Number", 'Nurse' AS "Role"
        FROM NURSE N JOIN NURSE_PhoneNum NP ON N.ID = NP.ID
    `;
    try {
        const data = await executeQuery(sql);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Query 3 (Aggregation + GROUP BY): Total medicine cost per patient
app.get('/api/query3', async (req, res) => {
    const sql = `
        SELECT P.Name AS "Patient_Name", SUM(M.Price) AS "Total_Medicine_Cost"
        FROM PATIENT P
        JOIN MEDICINE M ON P.ID = M.P_ID
        GROUP BY P.Name
        ORDER BY SUM(M.Price) DESC
    `;
    try {
        const data = await executeQuery(sql);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Query 4 (GROUP BY Clause)
app.get('/api/query4', async (req, res) => {
    const sql = `
        SELECT R.Room_Type AS "Room_Type", COUNT(P.ID) AS "Total_Patients"
        FROM PATIENT P 
        JOIN ROOM R ON P.P_Room_num = R.Room_Num 
        GROUP BY R.Room_Type
    `;
    try {
        const data = await executeQuery(sql);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Query 5 (Self-Join): Doctor Supervisors
app.get('/api/query5', async (req, res) => {
    const sql = `
        SELECT Worker.Name AS "Doctor_Name", Supervisor.Name AS "Supervisor_Name"
        FROM DOCTOR Worker
        INNER JOIN DOCTOR Supervisor ON Worker.SID = Supervisor.ID
    `;
    try {
        const data = await executeQuery(sql);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
