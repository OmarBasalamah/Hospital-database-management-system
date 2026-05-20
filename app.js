const appConfig = {
    table: {
        patient: { title: "Patients Directory", desc: "Viewing all records from the PATIENT table. Search across all columns.", endpoint: "/api/tables/patient" },
        doctor: { title: "Doctors Directory", desc: "Viewing all records from the DOCTOR table.", endpoint: "/api/tables/doctor" },
        doctor_phone: { title: "Doctor Phones", desc: "Viewing all records from the DOCTOR_PhoneNum table.", endpoint: "/api/tables/doctor_phonenum" },
        nurse: { title: "Nurses Roster", desc: "Viewing all records from the NURSE table.", endpoint: "/api/tables/nurse" },
        nurse_phone: { title: "Nurse Phones", desc: "Viewing all records from the NURSE_PhoneNum table.", endpoint: "/api/tables/nurse_phonenum" },
        room: { title: "Hospital Rooms", desc: "Viewing all records from the ROOM table.", endpoint: "/api/tables/room" },
        medicine: { title: "Medicine Inventory", desc: "Viewing all records from the MEDICINE table.", endpoint: "/api/tables/medicine" },
        companion: { title: "Patient Companions", desc: "Viewing all records from the COMPANION table.", endpoint: "/api/tables/companion" }
    },
    query: {
        1: { 
            title: "Patient Room Assignments", 
            desc: "Retrieving the names of all patients along with their room type (INNER JOIN).", 
            endpoint: "/api/query1",
            sql: "SELECT P.Name AS Patient_Name, R.Room_Type \nFROM PATIENT P \nJOIN ROOM R ON P.P_Room_num = R.Room_Num;",
            algebra: "π Name, Room_Type (PATIENT ⨝ P_Room_num=Room_Num ROOM)"
        },
        2: { 
            title: "Staff Phone Directory", 
            desc: "A complete list of all phone numbers with the name of the owner (Doctor or Nurse), combined using a UNION.", 
            endpoint: "/api/query2",
            sql: "SELECT D.Name AS Owner_Name, DP.D_PhoneNum AS Phone_Number, 'Doctor' AS Role\nFROM DOCTOR D\nJOIN DOCTOR_PhoneNum DP ON D.ID = DP.ID\nUNION\nSELECT N.Name AS Owner_Name, NP.N_PhoneNum AS Phone_Number, 'Nurse' AS Role\nFROM NURSE N\nJOIN NURSE_PhoneNum NP ON N.ID = NP.ID;",
            algebra: "π Name, D_PhoneNum (DOCTOR ⨝ ID=ID DOCTOR_PhoneNum)\n∪\nπ Name, N_PhoneNum (NURSE ⨝ ID=ID NURSE_PhoneNum)"
        },
        3: { 
            title: "Medicine Cost Per Patient", 
            desc: "Calculating the total price of all medicines prescribed to each patient using SUM and GROUP BY.", 
            endpoint: "/api/query3",
            sql: "SELECT P.Name AS Patient_Name, SUM(M.Price) AS Total_Medicine_Cost\nFROM PATIENT P\nJOIN MEDICINE M ON P.ID = M.P_ID\nGROUP BY P.Name\nORDER BY Total_Medicine_Cost DESC;",
            algebra: "Name ℱ SUM(Price) (PATIENT ⨝ ID=P_ID MEDICINE)"
        },
        4: { 
            title: "Room Capacity Monitor", 
            desc: "Finding the total number of patients admitted to each specific room type to monitor room capacity (GROUP BY).", 
            endpoint: "/api/query4",
            sql: "SELECT R.Room_Type, COUNT(P.ID) AS Total_Patients \nFROM PATIENT P \nJOIN ROOM R ON P.P_Room_num = R.Room_Num \nGROUP BY R.Room_Type;",
            algebra: "Room_Type ℱ COUNT(ID) (PATIENT ⨝ P_Room_num=Room_Num ROOM)"
        },
        5: { 
            title: "Doctor Hierarchy", 
            desc: "A self-join mapping the hierarchy to display the names of doctors alongside the names of the doctors who supervise them.", 
            endpoint: "/api/query5",
            sql: "SELECT Worker.Name AS Doctor_Name, Supervisor.Name AS Supervisor_Name\nFROM DOCTOR Worker\nINNER JOIN DOCTOR Supervisor ON Worker.SID = Supervisor.ID;",
            algebra: "π Worker.Name, Supervisor.Name (ρ Worker (DOCTOR) ⨝ Worker.SID=Supervisor.ID ρ Supervisor (DOCTOR))"
        }
    }
};

let currentData = []; // Store the fetched data for live search filtering
let currentType = ''; // 'table' or 'query'
let currentId = '';

document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const queryTitle = document.getElementById('query-title');
    const queryDesc = document.getElementById('query-desc');
    const tableContainer = document.getElementById('table-container');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('error-message');
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const queryDetails = document.getElementById('query-details');
    const sqlCode = document.getElementById('sql-code');
    const algebraCode = document.getElementById('algebra-code');

    // Load initial view (Patients table)
    loadData('table', 'patient');

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            navButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const type = e.currentTarget.getAttribute('data-type');
            const id = e.currentTarget.getAttribute('data-id');
            
            // Clear search input on tab switch
            searchInput.value = '';
            
            loadData(type, id);
        });
    });

    // Live Search Event Listener
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        if (!term) {
            renderTable(currentData);
            return;
        }

        // Filter currentData based on the search term
        const filteredData = currentData.filter(row => {
            // Check if any column value contains the search term
            return Object.values(row).some(val => {
                if (val === null || val === undefined) return false;
                return String(val).toLowerCase().includes(term);
            });
        });

        renderTable(filteredData, term);
    });

    async function loadData(type, id) {
        currentType = type;
        currentId = id;
        const config = appConfig[type][id];
        
        queryTitle.textContent = config.title;
        queryDesc.textContent = config.desc;
        
        // Show/hide specific sections based on whether it's a table or a query
        if (type === 'table') {
            searchContainer.classList.remove('hidden');
            queryDetails.classList.add('hidden');
        } else {
            searchContainer.classList.add('hidden');
            // Populate and show the SQL and Relational Algebra
            sqlCode.textContent = config.sql;
            algebraCode.textContent = config.algebra;
            queryDetails.classList.remove('hidden');
        }
        
        tableContainer.innerHTML = '';
        errorMessage.classList.add('hidden');
        loader.classList.remove('hidden');

        try {
            const response = await fetch(config.endpoint);
            if (!response.ok) throw new Error("Server not responding");
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error);
            }

            currentData = data.data;
            renderView(currentData, type, id);
            
        } catch (error) {
            console.warn("Server fetch failed, falling back to mock data:", error);
            
            // Extensive Mock Data Fallback
            const mockDataObj = getMockData();
            
            if (type === 'table' && mockDataObj.tables[id]) {
                currentData = mockDataObj.tables[id];
                renderView(currentData, type, id);
            } else if (type === 'query' && mockDataObj.queries[id]) {
                currentData = mockDataObj.queries[id];
                renderView(currentData, type, id);
            } else {
                errorMessage.textContent = `Error: ${error.message}. (Mock data not found for this view)`;
                errorMessage.classList.remove('hidden');
            }
        } finally {
            loader.classList.add('hidden');
        }
    }

    function renderView(data, type, id) {
        if (!data || data.length === 0) {
            tableContainer.innerHTML = '<p style="text-align:center; color: #94a3b8; padding: 2rem;">No data found.</p>';
            return;
        }

        // Render Table for everything
        renderTable(data);
    }

    function renderTable(data, searchTerm = '') {
        if (!data || data.length === 0) {
            tableContainer.innerHTML = '<p style="text-align:center; color: #94a3b8; padding: 2rem;">No matches found for your search.</p>';
            return;
        }

        const columns = Object.keys(data[0]);
        let tableHTML = '<table class="fade-in"><thead><tr>';
        
        // Column header label overrides for clarity
        const headerLabels = {
            'SID': 'Supervisor ID',
            'EXPERIENCE': 'Years of Experience',
            'DATE_OF_BIRTH': 'Date of Birth'
        };

        columns.forEach(col => {
            const label = headerLabels[col] || col.replace(/_/g, ' ');
            tableHTML += `<th>${label}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';

        data.forEach(row => {
            tableHTML += '<tr>';
            columns.forEach(col => {
                let rawVal = row[col];
                let cellValue;

                if (rawVal === null || rawVal === undefined) {
                    cellValue = '-';
                } else if (col === 'DATE_OF_BIRTH' || col === 'EXPIRATION_DATE') {
                    // Format date strings cleanly to YYYY-MM-DD
                    const d = new Date(rawVal);
                    if (!isNaN(d)) {
                        const yyyy = d.getUTCFullYear();
                        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                        const dd = String(d.getUTCDate()).padStart(2, '0');
                        cellValue = `${yyyy}-${mm}-${dd}`;
                    } else {
                        cellValue = String(rawVal);
                    }
                } else if (col === 'PRICE' || col === 'Total_Medicine_Cost' || col === 'TOTAL_MEDICINE_COST') {
                    cellValue = '$' + parseFloat(rawVal).toFixed(2);
                } else {
                    cellValue = String(rawVal);
                }
                
                // If there's a search term, highlight the matching text
                if (searchTerm && cellValue !== '-') {
                    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, "gi");
                    cellValue = cellValue.replace(regex, "<span class='highlight'>$1</span>");
                }
                
                tableHTML += `<td>${cellValue}</td>`;
            });
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';
        tableContainer.innerHTML = tableHTML;
    }
});

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- FULL MOCK DATA FALLBACK ---
// This enables the "double-click index.html" Option 1 method to work flawlessly
function getMockData() {
    return {
        tables: {
            patient: [
                { ID: 1, NAME: 'Ammar',  DATE_OF_BIRTH: '1995-04-12', SEX: 'M', D_ID: 1, N_ID: 1, P_ROOM_NUM: 101 },
                { ID: 2, NAME: 'Khalid', DATE_OF_BIRTH: '1988-11-25', SEX: 'M', D_ID: 2, N_ID: 2, P_ROOM_NUM: 102 },
                { ID: 3, NAME: 'Saad',   DATE_OF_BIRTH: '1970-01-15', SEX: 'M', D_ID: 3, N_ID: 3, P_ROOM_NUM: 104 },
                { ID: 4, NAME: 'Maha',   DATE_OF_BIRTH: '2018-09-09', SEX: 'F', D_ID: 4, N_ID: 5, P_ROOM_NUM: 103 },
                { ID: 5, NAME: 'Nasser', DATE_OF_BIRTH: '1982-11-30', SEX: 'M', D_ID: 5, N_ID: 4, P_ROOM_NUM: 105 },
                { ID: 6, NAME: 'Rima',   DATE_OF_BIRTH: '1993-02-14', SEX: 'F', D_ID: 2, N_ID: 1, P_ROOM_NUM: 102 },
                { ID: 7, NAME: 'Hassan', DATE_OF_BIRTH: '1965-05-20', SEX: 'M', D_ID: 1, N_ID: 2, P_ROOM_NUM: 101 }
            ],
            doctor: [
                { ID: 1, NAME: 'Dr. Faisal', SPECIALIZATION: 'Cardiology',       SID: null },
                { ID: 6, NAME: 'Dr. Sarah',  SPECIALIZATION: 'Head of Surgery',  SID: null },
                { ID: 2, NAME: 'Dr. Omar',   SPECIALIZATION: 'Internal Medicine', SID: 1 },
                { ID: 3, NAME: 'Dr. Salem',  SPECIALIZATION: 'Neurology',         SID: 1 },
                { ID: 4, NAME: 'Dr. Nora',   SPECIALIZATION: 'Pediatrics',        SID: null },
                { ID: 5, NAME: 'Dr. Tariq',  SPECIALIZATION: 'Orthopedics',       SID: 6 }
            ],
            doctor_phone: [
                { ID: 1, D_PhoneNum: '0501112222' },
                { ID: 2, D_PhoneNum: '0503334444' },
                { ID: 3, D_PhoneNum: '0504445555' },
                { ID: 4, D_PhoneNum: '0505556666' },
                { ID: 5, D_PhoneNum: '0506667777' },
                { ID: 6, D_PhoneNum: '0507778888' }
            ],
            nurse: [
                { ID: 1, NAME: 'Nurse Fatima', EXPERIENCE: '8 years' },
                { ID: 2, NAME: 'Nurse Sara',   EXPERIENCE: '3 years' },
                { ID: 3, NAME: 'Nurse Aisha',  EXPERIENCE: '12 years' },
                { ID: 4, NAME: 'Nurse Majed',  EXPERIENCE: '2 years' },
                { ID: 5, NAME: 'Nurse Laila',  EXPERIENCE: '5 years' }
            ],
            nurse_phone: [
                { ID: 1, N_PhoneNum: '0505556666' },
                { ID: 2, N_PhoneNum: '0509998888' },
                { ID: 3, N_PhoneNum: '0508887777' },
                { ID: 4, N_PhoneNum: '0507776666' },
                { ID: 5, N_PhoneNum: '0506665555' }
            ],
            room: [
                { ROOM_NUM: 101, ROOM_TYPE: 'ICU',              CAPACITY: 2  },
                { ROOM_NUM: 102, ROOM_TYPE: 'General',           CAPACITY: 4  },
                { ROOM_NUM: 103, ROOM_TYPE: 'Pediatrics',        CAPACITY: 3  },
                { ROOM_NUM: 104, ROOM_TYPE: 'Emergency',         CAPACITY: 10 },
                { ROOM_NUM: 105, ROOM_TYPE: 'Surgery Recovery',  CAPACITY: 2  },
                { ROOM_NUM: 106, ROOM_TYPE: 'Maternity',         CAPACITY: 3  }
            ],
            medicine: [
                { MID_ID: 5001, NAME: 'Lisinopril',   MANUFACTURER: 'PharmaCorp', PRICE: 45.50,  EXPIRATION_DATE: '2026-12-01', D_ID: 1, P_ID: 1 },
                { MID_ID: 5002, NAME: 'Amoxicillin',  MANUFACTURER: 'MediLife',   PRICE: 25.00,  EXPIRATION_DATE: '2025-08-15', D_ID: 2, P_ID: 2 },
                { MID_ID: 5003, NAME: 'Paracetamol',  MANUFACTURER: 'GSK',        PRICE: 10.00,  EXPIRATION_DATE: '2027-01-01', D_ID: 4, P_ID: 4 },
                { MID_ID: 5004, NAME: 'Metformin',    MANUFACTURER: 'Merck',      PRICE: 35.00,  EXPIRATION_DATE: '2026-06-01', D_ID: 2, P_ID: 6 },
                { MID_ID: 5005, NAME: 'Atorvastatin', MANUFACTURER: 'Pfizer',     PRICE: 60.00,  EXPIRATION_DATE: '2025-11-01', D_ID: 1, P_ID: 7 },
                { MID_ID: 5006, NAME: 'Morphine',     MANUFACTURER: 'J&J',        PRICE: 120.00, EXPIRATION_DATE: '2025-05-01', D_ID: 5, P_ID: 5 },
                { MID_ID: 5007, NAME: 'Levetiracetam',MANUFACTURER: 'UCB',        PRICE: 85.00,  EXPIRATION_DATE: '2026-08-15', D_ID: 3, P_ID: 3 },
                { MID_ID: 5008, NAME: 'Ibuprofen',    MANUFACTURER: 'Bayer',      PRICE: 15.00,  EXPIRATION_DATE: '2028-02-20', D_ID: 5, P_ID: 5 }
            ],
            companion: [
                { PATIENT_NAME: 'Ammar',  COMPANION_NAME: 'Yousef', RELATIONSHIP: 'Brother', CONTACT_NUM: '0507778888' },
                { PATIENT_NAME: 'Saad',   COMPANION_NAME: 'Fahad',  RELATIONSHIP: 'Son',     CONTACT_NUM: '0501234567' },
                { PATIENT_NAME: 'Maha',   COMPANION_NAME: 'Hind',   RELATIONSHIP: 'Mother',  CONTACT_NUM: '0507654321' },
                { PATIENT_NAME: 'Rima',   COMPANION_NAME: 'Ahmed',  RELATIONSHIP: 'Spouse',  CONTACT_NUM: '0501122334' }
            ]
        },
        queries: {
            1: [
                { "Patient_Name": "Ammar", "Room_Type": "ICU" },
                { "Patient_Name": "Khalid", "Room_Type": "General" },
                { "Patient_Name": "Saad", "Room_Type": "Emergency" },
                { "Patient_Name": "Maha", "Room_Type": "Pediatrics" },
                { "Patient_Name": "Nasser", "Room_Type": "Surgery Recovery" },
                { "Patient_Name": "Rima", "Room_Type": "General" },
                { "Patient_Name": "Hassan", "Room_Type": "ICU" }
            ],
            2: [
                { "Owner_Name": "Dr. Faisal", "Phone_Number": "0501112222", "Role": "Doctor" },
                { "Owner_Name": "Dr. Omar",   "Phone_Number": "0503334444", "Role": "Doctor" },
                { "Owner_Name": "Dr. Salem",  "Phone_Number": "0504445555", "Role": "Doctor" },
                { "Owner_Name": "Dr. Nora",   "Phone_Number": "0505556666", "Role": "Doctor" },
                { "Owner_Name": "Dr. Tariq",  "Phone_Number": "0506667777", "Role": "Doctor" },
                { "Owner_Name": "Dr. Sarah",  "Phone_Number": "0507778888", "Role": "Doctor" },
                { "Owner_Name": "Nurse Fatima", "Phone_Number": "0505556666", "Role": "Nurse" },
                { "Owner_Name": "Nurse Sara",   "Phone_Number": "0509998888", "Role": "Nurse" },
                { "Owner_Name": "Nurse Aisha",  "Phone_Number": "0508887777", "Role": "Nurse" },
                { "Owner_Name": "Nurse Majed",  "Phone_Number": "0507776666", "Role": "Nurse" },
                { "Owner_Name": "Nurse Laila",  "Phone_Number": "0506665555", "Role": "Nurse" }
            ],
            3: [
                { "Patient_Name": "Ammar",  "Total_Medicine_Cost": 45.50  },
                { "Patient_Name": "Khalid", "Total_Medicine_Cost": 25.00  },
                { "Patient_Name": "Saad",   "Total_Medicine_Cost": 85.00  },
                { "Patient_Name": "Maha",   "Total_Medicine_Cost": 10.00  },
                { "Patient_Name": "Nasser", "Total_Medicine_Cost": 135.00 },
                { "Patient_Name": "Rima",   "Total_Medicine_Cost": 35.00  },
                { "Patient_Name": "Hassan", "Total_Medicine_Cost": 60.00  }
            ],
            4: [
                { "Room_Type": "ICU",             "Total_Patients": 2 },
                { "Room_Type": "General",          "Total_Patients": 2 },
                { "Room_Type": "Emergency",        "Total_Patients": 1 },
                { "Room_Type": "Pediatrics",       "Total_Patients": 1 },
                { "Room_Type": "Surgery Recovery", "Total_Patients": 1 }
            ],
            5: [
                { "Doctor_Name": "Dr. Omar",  "Supervisor_Name": "Dr. Faisal" },
                { "Doctor_Name": "Dr. Salem", "Supervisor_Name": "Dr. Faisal" },
                { "Doctor_Name": "Dr. Tariq", "Supervisor_Name": "Dr. Sarah" }
            ]
        }
    };
}
