const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
// const swaggerJsdoc = require('swagger-jsdoc');
// const swaggerUi = require('swagger-ui-express');
// const swaggerDefinition = require('./swaggerDefinition');
// const swaggerDocument = require('./swagger.json');
const authenticateToken = require('./Authtoken');

const app = express();

// Swagger setup
// const options = {
//     swaggerDefinition,
//     apis: ['./*.js'], // Assuming your route files are in the same directory
// };

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(express.json());
require('dotenv').config();

app.use(cors({
    origin: 'http://localhost:3000'
}));

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.status(201).send('User registered successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ username: user.username }, process.env.SECRET_KEY);
            // Add token to the database
            await pool.query('UPDATE users SET token = $1 WHERE username = $2', [token, username]);
            res.json({ token });
        } else {
            res.status(401).send('Invalid username or password');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.post('/logout', async (req, res) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(400).send('Token is missing');
    }

    try {
        // Remove token from the database
        await pool.query('UPDATE users SET token = NULL WHERE token = $1', [token]);
        res.status(200).send('Logout successful');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.post('/reset-password', async (req, res) => {
    const { username, newPassword } = req.body;

    try {
        // Check if user exists
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password in the database
        await pool.query('UPDATE users SET password = $1 WHERE username = $2', [hashedNewPassword, username]);

        res.status(200).send('Password reset successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});



// app.get('/protected', authenticateToken, (req, res) => {
//     res.send('Protected route');
// });

// Products Routes

app.get('/products_item', authenticateToken, async (req, res) => {
    try {
        const all_products = await pool.query("SELECT id, name, is_active FROM products_item");
        res.json(all_products.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/products_item/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const product = await pool.query("SELECT id, name, is_active FROM products_item WHERE id = $1", [id]);
        if (product.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json(product.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.post('/products_item', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        const created_by_id = req.user && req.user.id;
        if (!created_by_id) {
            return res.status(400).json({ error: 'User ID not found' });
        }
        const new_product = await pool.query(
            "INSERT INTO products_item (name, created_by_id, is_active) VALUES ($1, $2, true) RETURNING *",
            [name, created_by_id]
        );

        res.status(201).json(new_product.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.put('/products_item/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updated_by_id = req.user && req.user.id;
        const { name, is_active } = req.body;
        const update_product = await pool.query(
            "UPDATE products_item SET name = $1, updated_by_id = $2, is_active = $3 WHERE id = $4 RETURNING *",
            [name, updated_by_id, is_active, id]
        );
        if (update_product.rows.length === 0) {
            return res.status(404).json({ error: "No products found" });
        }
        res.json(update_product.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.delete('/products_item/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM products_item WHERE id = $1", [id]);
        res.json("Product deleted");
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Unit Routes
app.post("/create_unit", authenticateToken, async (req, res) => {
    try {
        const { unit_name, code } = req.body;
        const created_by_id = req.user && req.user.id;
        if (!created_by_id) {
            return res.status(400).json({ error: 'User ID not found' });
        }

        const create_unit = await pool.query(
            "INSERT INTO products_unit (unit_name, created_by_id, code, is_active) VALUES ($1, $2, $3, true) RETURNING *",
            [unit_name, created_by_id, code]
        );

        res.status(201).json(create_unit.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


app.get("/all_unit", authenticateToken, async (req, res) => {
    try {
        const get_all_unit = await pool.query("SELECT id, unit_name, code, is_active FROM products_unit");
        res.json(get_all_unit.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("server error");
    }
});


app.get("/unit/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const unit = await pool.query("SELECT id, unit_name, code FROM products_unit WHERE id = $1", [id]);
        if (unit.rows.length === 0) {
            return res.status(404).json({ error: "Unit not found" });
        }
        res.json(unit.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.put("/unit/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { unit_name, code } = req.body;
        const updatedUnit = await pool.query(
            "UPDATE products_unit SET unit_name = $1, code = $2 WHERE id = $3 RETURNING *",
            [unit_name, code, id]
        );
        if (updatedUnit.rows.length === 0) {
            return res.status(404).json({ error: "Unit not found" });
        }
        res.json(updatedUnit.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.delete("/unit/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM products_unit WHERE id = $1", [id]);
        res.json({ message: "Unit deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Orders Routes
app.get("/grocery_orders", authenticateToken, async (req, res) => {
    try {
        const get_all_orders = await pool.query("SELECT id, name, TO_CHAR(from_date, 'YYYY/MM/DD') as from_date, TO_CHAR(to_date, 'YYYY/MM/DD') as to_date, is_end FROM products_groceryorder");
        res.json(get_all_orders.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("server error");
    }
});

app.post('/grocery_orders', authenticateToken, async (req, res) => {
    try {
        const { name, from_date, to_date, is_end } = req.body;
        const created_by_id = req.user && req.user.id;
        if (!name || !from_date || !to_date || is_end === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (from_date > to_date) {
            return res.status(400).json({ error: 'From date cannot be greater than to date' });
        }
        const dateFormatRegex = /^\d{4}\/\d{2}\/\d{2}$/;
        if (!dateFormatRegex.test(from_date) || !dateFormatRegex.test(to_date)) {
            return res.status(400).json({ error: 'Invalid date format. Date format should be YYYY/MM/DD' });
        }
        const newGroceryOrder = await pool.query(
            'INSERT INTO products_groceryorder (name, from_date, to_date, is_end, created_by_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, from_date, to_date, is_end, created_by_id]
        );
        res.status(201).json(newGroceryOrder.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.put("/grocery_orders/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updated_by_id = req.user && req.user.id;
        const { name, from_date, to_date, is_end } = req.body;
        const update_grocery_order = await pool.query(
            "UPDATE products_groceryorder SET name = $1, updated_by_id = $2, is_end = $3, from_date = $4, to_date = $5 WHERE id = $6 RETURNING *",
            [name, updated_by_id, is_end, from_date, to_date, id]
        );
        if (update_grocery_order.rows.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }
        res.json(update_grocery_order.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.post('/create_grocery_order_item', authenticateToken, async (req, res) => {
    try {
        const { rate, order_id, product_id, unit_id, quantity } = req.body;
        const created_by_id = req.user && req.user.id;

        if (!rate || !order_id || !product_id || !unit_id || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const newOrderItem = await pool.query(
            'INSERT INTO products_groceryorderitem (rate, created_by_id, order_id, product_id, unit_id, quantity, updated_by_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [rate, created_by_id, order_id, product_id, unit_id, quantity, created_by_id]
        );
        res.status(201).json(newOrderItem.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});
app.get("/order_details/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const order_details = await pool.query(
            "SELECT pg.id AS orderId, pi.name, pu.unit_name AS unit, pgi.rate, pgi.quantity, pgi.total_amount AS total " +
            "FROM products_groceryorderitem pgi " +
            "JOIN products_item pi ON pi.id = pgi.product_id " +
            "JOIN products_unit pu ON pgi.unit_id = pu.id " +
            "JOIN public.products_groceryorder pg ON pgi.order_id = pg.id " +
            "WHERE pg.id = $1",
            [id]
        );
        res.json(order_details.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.get("/order_by_id/:id?", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        let query = "SELECT pg.id, pi.name, pu.unit_name AS unit, pgi.rate, pgi.quantity, pgi.total_amount AS total " +
            "FROM products_groceryorderitem pgi " +
            "JOIN products_item pi ON pi.id = pgi.product_id " +
            "JOIN products_unit pu ON pgi.unit_id = pu.id " +
            "JOIN public.products_groceryorder pg ON pgi.order_id = pg.id";
        if (id) {
            query += " WHERE pi.id = $1";
        }

        const order_details = await pool.query(query, id ? [id] : []);
        res.json(order_details.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get("/chart_data", authenticateToken, async (req, res) => {
    try {
        const query = "SELECT p.name, SUM(total_amount) " +
            "FROM products_groceryorderitem pg " +
            "JOIN public.products_groceryorder p ON pg.order_id = p.id " +
            "GROUP BY order_id, p.name";
        const report_data = await pool.query(query);
        res.json(report_data.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.listen(8080, () => {
    console.log('Server is running on port 8080');
});