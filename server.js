require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const sessionManager = require('./src/auth');
const { cleanHTML } = require('./src/cleaner');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // For local dev and proxying
}));
app.use(compression()); // Gzip compression
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Mock target for demonstration if no ERP provided
const DEFAULT_ERP_BASE = 'https://gietuerp.in'; // As seen in previous chats

// Proxy Endpoint (Handles both GET and POST)
const handleProxy = async (req, res) => {
    const { url, sessionId } = req.method === 'GET' ? req.query : req.body;
    const targetUrl = url || req.query.url;

    if (!targetUrl) return res.status(400).send('URL required');

    try {
        const client = sessionManager.getClient(sessionId);
        let finalUrl = targetUrl;
        if (targetUrl.startsWith('/')) {
            finalUrl = `${DEFAULT_ERP_BASE}${targetUrl}`;
        }

        const config = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': targetUrl.startsWith('http') ? targetUrl : `${DEFAULT_ERP_BASE}${targetUrl}`,
                'Origin': new URL(targetUrl.startsWith('http') ? targetUrl : DEFAULT_ERP_BASE).origin,
                'Content-Type': req.headers['content-type'] || 'application/x-www-form-urlencoded'
            },
            responseType: 'arraybuffer',
            maxRedirects: 10,
            validateStatus: (status) => status >= 200 && status < 500 // Allow 404/401 to be handled by our logic
        };

        let response;
        if (req.method === 'POST') {
            const { url, sessionId, ...formData } = req.body;
            response = await client.post(finalUrl, new URLSearchParams(formData).toString(), config);
        } else {
            response = await client.get(finalUrl, config);
        }

        const contentType = response.headers['content-type'] || '';
        const dataLength = response.data ? (response.data.byteLength || response.data.length || 0) : 0;
        console.log(`Proxy response for ${targetUrl}: ${contentType} (${dataLength} bytes)`);

        if (!response.data) {
            throw new Error('Empty response from ERP');
        }

        // Handle Images
        if (contentType.includes('image')) {
            res.set('Content-Type', contentType);
            return res.send(Buffer.from(response.data));
        }

        // Handle HTML
        const html = Buffer.from(response.data).toString('utf-8');
        const isLoginContent = html.includes('password') || html.includes('captcha');

        if (isLoginContent && !targetUrl.includes('login') && !targetUrl.includes('login_page')) {
            console.log(`Potential session issue for ${targetUrl}`);
        }

        const cleaned = cleanHTML(html, sessionId);
        res.send(cleaned);

    } catch (error) {
        console.error(`Proxy Error for ${targetUrl}:`);
        console.error(error.stack || error.message);
        res.status(500).send(`Error connecting to ERP systems: ${error.message}`);
    }
};

app.get('/proxy', handleProxy);
app.post('/proxy', handleProxy);

// Safety Route for root forms
app.post('/', (req, res) => {
    if (req.body.url) return handleProxy(req, res);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Session Creation
app.get('/api/session/new', (req, res) => {
    const sessionId = sessionManager.createSession();
    res.json({ sessionId });
});

// Auth Proxy - Legacy (Redirecting to new handler)
app.post('/proxy-login', (req, res) => {
    req.body.url = req.body.loginUrl;
    handleProxy(req, res);
});

// Cache Layer (Simple in-memory for MVP)
const cache = new Map();
app.get('/api/data', async (req, res) => {
    const { userId = 'default', type } = req.query; // type: attendance, results, fees
    const cacheKey = `${userId}-${type}`;

    if (cache.has(cacheKey)) {
        return res.json({ source: 'cache', data: cache.get(cacheKey) });
    }

    // Logic to fetch specifically from ERP and extract JSON would go here
    // For now, we simulate returning data
    const mockData = {
        attendance: '85%',
        results: 'GPA: 8.5',
        fees: 'Pending: 0'
    };

    cache.set(cacheKey, mockData[type]);
    res.json({ source: 'erp', data: mockData[type] });
});

// Mock ERP Page for Demo
app.get('/mock-erp', (req, res) => {
    const hasSession = req.headers.cookie && req.headers.cookie.includes('erp_session');

    if (!hasSession && !req.query.login_page) {
        return res.send(`
            <html>
                <body>
                    <h1>Access Denied</h1>
                    <p>No valid session. Please <a href="/mock-erp?login_page=true">Login here</a>.</p>
                </body>
            </html>
        `);
    }

    if (req.query.login_page) {
        return res.send(`
            <html>
                <head><title>Mock ERP Login</title></head>
                <body style="padding: 50px; font-family: sans-serif;">
                    <div style="max-width:300px; margin:auto; border:1px solid #ccc; padding:20px; border-radius:10px;">
                        <h2>University Login</h2>
                        <form action="/mock-login" method="POST">
                            <input type="text" name="user" placeholder="Roll No" style="width:100%; margin-bottom:10px; padding:8px;"><br>
                            <input type="password" name="pass" placeholder="Password" style="width:100%; margin-bottom:10px; padding:8px;"><br>
                            <div style="background:#eee; padding:10px; margin-bottom:10px; text-align:center;">
                                <strong>CAPTCHA: 9G4X</strong>
                            </div>
                            <input type="text" name="captcha" placeholder="Enter CAPTCHA" style="width:100%; margin-bottom:10px; padding:8px;"><br>
                            <button type="submit" style="width:100%; padding:10px; background:#4f46e5; color:white; border:none; border-radius:5px;">Sign In</button>
                        </form>
                        <p style="font-size:12px; color:#666; margin-top:20px;">* Solving this CAPTCHA is required by university policy.</p>
                    </div>
                </body>
            </html>
        `);
    }

    res.send(`
        <html>
            <head><title>Official University Dashboard</title></head>
            <body style="background:#f0f2f5;">
                <header style="background:white; padding:20px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    <h1>Student Portal Dashboard</h1>
                    <p>Welcome, Test Student | Last Login: Today</p>
                </header>
                <main style="max-width:800px; margin:20px auto; background:white; padding:20px; border-radius:8px;">
                    <h3>Academic Progress</h3>
                    <table border="1" style="width:100%; border-collapse:collapse;">
                        <tr style="background:#eee;"><th>Semester</th><th>GPA</th><th>Attendance</th></tr>
                        <tr><td>Sem 5</td><td>8.8</td><td>92%</td></tr>
                        <tr><td>Sem 4</td><td>8.5</td><td>88%</td></tr>
                    </table>
                    <div style="margin-top:20px;">
                        <h4>Notifications</h4>
                        <ul>
                            <li>Exam fees due by 15th Feb.</li>
                            <li>Library book return overdue.</li>
                        </ul>
                    </div>
                </main>
                <footer style="padding:20px; text-align:center; color:#999;">© 2026 Mock University ERP Systems</footer>
            </body>
        </html>
    `);
});

// Mock Login Handler
app.post('/mock-login', (req, res) => {
    const { user, pass, captcha } = req.body;
    if (captcha === '9G4X') {
        res.cookie('erp_session', 'valid_token_123', { httpOnly: true });
        res.redirect('/mock-erp');
    } else {
        res.send('Invalid CAPTCHA! Please try again.');
    }
});

app.listen(PORT, () => {
    console.log(`UniLite Proxy running at http://localhost:${PORT}`);
    console.log(`SDG 10 Alignment: Reducing digital inequality.`);
});
