// METALWORKS/backend/index.js

// Import necessary modules
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise'); 
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
// const jwt = require('jsonwebtoken'); // Uncomment if you implement JWT

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
const REACT_APP_FRONTEND_URL = process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000';
// const JWT_SECRET = process.env.JWT_SECRET; // Add JWT_SECRET to your .env if using JWT

// --- Middleware ---
const corsOptions = {
  origin: REACT_APP_FRONTEND_URL,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/public_images_backend', express.static(path.join(__dirname, 'public/images')));


// --- Database Connection Pool ---
const dbPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'metalworks',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true 
});

dbPool.getConnection()
  .then(connection => {
    console.log('Successfully connected to the Metalworks database!');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to the database:', err.stack);
  });

// --- Authentication Middleware (Placeholder) ---
const authenticateUser = (req, res, next) => {
  const userIdFromHeader = req.headers['temp-user-id'];
  if (userIdFromHeader && !isNaN(parseInt(userIdFromHeader))) {
    req.user = { CustomerID: parseInt(userIdFromHeader) };
    console.log(`Authenticated (temp) user: CustomerID ${req.user.CustomerID}`);
    next();
  } else {
    console.warn("WARN: No valid 'temp-user-id' header. Cart operations might fail or use defaults if not strictly user-specific.");
    if (req.path.startsWith('/api/cart')) { 
        return res.status(401).json({ message: "User not identified. Please send 'temp-user-id' header for cart operations." });
    }
    // For POST /api/orders, it has its own fallback if req.user is not set.
    next(); 
  }
};


// --- API Routes ---

// Signup Route
app.post('/api/auth/signup', async (req, res) => {
  const { firstName, lastName, userEmail, password } = req.body;
  if (!firstName || !lastName || !userEmail || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }
  let connection;
  try {
    connection = await dbPool.getConnection();
    const [rows] = await connection.execute('SELECT * FROM `customer` WHERE `userEmail` = ?', [userEmail]);
    if (rows.length > 0) {
      return res.status(409).json({ message: 'Email already in use.' });
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const [result] = await connection.execute(
      'INSERT INTO `customer` (`firstName`, `lastName`, `userEmail`, `password_hash`) VALUES (?, ?, ?, ?)',
      [firstName, lastName, userEmail, hashedPassword]
    );
    res.status(201).json({ message: 'User registered successfully!', userId: result.insertId });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'An error occurred during registration.' });
  } finally {
    if (connection) connection.release();
  }
});

// **NEW** Login Route
app.post('/api/auth/login', async (req, res) => {
  const { userEmail, password } = req.body;
  if (!userEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    const [rows] = await connection.execute('SELECT * FROM `customer` WHERE `userEmail` = ?', [userEmail]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' }); // User not found
    }

    const user = rows[0]; // Customer table has: CustomerID, firstName, lastName, userEmail, password_hash
    const passwordIsValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Invalid email or password.' }); // Password mismatch
    }

    // User authenticated successfully
    const userDataForFrontend = {
      CustomerID: user.CustomerID, // Ensure your customer table has CustomerID as primary key
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.userEmail // Frontend might expect 'email'
    };

    // Generate a token (IMPORTANT: Replace with actual JWT generation in production)
    // const token = jwt.sign(
    //   { CustomerID: user.CustomerID, email: user.userEmail },
    //   JWT_SECRET, 
    //   { expiresIn: '1h' } // Example: token expires in 1 hour
    // );
    const token = "fake-auth-token-replace-with-real-jwt"; // Placeholder token

    res.status(200).json({
      message: 'Login successful!',
      user: userDataForFrontend,
      token: token 
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during login. Please try again.' });
  } finally {
    if (connection) connection.release();
  }
});


// Get All Products Route
app.get('/api/products', async (req, res) => {
  // ... (same as before)
  let connection;
  try {
    connection = await dbPool.getConnection();
    const [products] = await connection.execute('SELECT * FROM `products`');
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to retrieve products.' });
  } finally {
    if (connection) connection.release();
  }
});

// Get Single Product by ID Route
app.get('/api/products/:id', async (req, res) => {
  // ... (same as before)
  const { id } = req.params;
  let connection;
  try {
    connection = await dbPool.getConnection();
    const [rows] = await connection.execute('SELECT * FROM `products` WHERE `ProductID` = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error(`Error fetching product with ID ${id}:`, error);
    res.status(500).json({ message: 'Failed to retrieve product details.' });
  } finally {
    if (connection) connection.release();
  }
});

// Create New Order Route
app.post('/api/orders', authenticateUser, async (req, res) => { 
  const customerId = req.user?.CustomerID || 1; 
  const { items: itemsInPayload, paymentMethod, finalTotal, isRushOrder } = req.body;
  // ... (rest of the order logic remains the same) ...
  if (!itemsInPayload || itemsInPayload.length === 0) {
    return res.status(400).json({ message: 'Order must contain at least one item.' });
  }
  if (!paymentMethod || finalTotal === undefined) {
    return res.status(400).json({ message: 'Payment method and total amount are required.' });
  }
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();
    const orderDate = new Date().toISOString().slice(0, 10); 
    const rushOrderText = isRushOrder ? '1' : '0';
    const approvalStatus = 'Pending'; 
    const [orderResult] = await connection.execute(
      'INSERT INTO `order` (`CustomerID`, `OrderDate`, `RushOrder`, `ApprovalStatus`, `TotalCost`) VALUES (?, ?, ?, ?, ?)',
      [customerId, orderDate, rushOrderText, approvalStatus, finalTotal]
    );
    const newOrderId = orderResult.insertId;
    for (const cartItem of itemsInPayload) {
      const itemTotalCost = (Number(cartItem.unitPrice) || 0) * (cartItem.quantity || 1);
      const placeholderPricingTierID = 0; 
      await connection.execute(
        'INSERT INTO `item` (`OrderID`, `PricingTierID`, `UnitPrice`, `TotalCost`, `Quantity`, `ProductID`) VALUES (?, ?, ?, ?, ?, ?)',
        [newOrderId, placeholderPricingTierID, cartItem.unitPrice, itemTotalCost, cartItem.quantity, cartItem.productId]
      );
    }
    const paymentAddressPlaceholder = "Order Payment - Address N/A"; 
    const placeholderOriginalPaymentID = 0;
    await connection.execute(
      'INSERT INTO `paymentmethod` (`CustomerID`, `OrderID`, `PaymentID`, `Details`, `Address`) VALUES (?, ?, ?, ?, ?)',
      [customerId, newOrderId, placeholderOriginalPaymentID, paymentMethod, paymentAddressPlaceholder] 
    );
    await connection.commit();
    res.status(201).json({ 
      message: 'Order placed successfully!', 
      orderDetails: { 
        orderId: newOrderId, customerId, orderDate, totalAmount: finalTotal,
        paymentMethod, itemCount: itemsInPayload.length 
      } 
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error placing order:', error); 
    res.status(500).json({ message: 'Failed to place order. Please check server logs.' });
  } finally {
    if (connection) connection.release();
  }
});


// --- User-Specific Cart API Routes ---
// ... (cart routes as implemented before, all using authenticateUser) ...
app.get('/api/cart', authenticateUser, async (req, res) => {
    const customerId = req.user.CustomerID;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [cartDbItems] = await connection.execute(
            `SELECT ci.ID as CartItemID, ci.ProductID, ci.Quantity, ci.Price as UnitPrice, ci.RushOrder,
                    p.Name, p.ImagePath, p.Description, p.ItemType, p.Material, p.Stock
             FROM cart_items ci
             JOIN products p ON ci.ProductID = p.ProductID
             WHERE ci.CustomerID = ?`,
            [customerId]
        );
        res.status(200).json(cartDbItems);
    } catch (error) {
        console.error(`Error fetching cart for CustomerID ${customerId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve cart.' });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/cart/items', authenticateUser, async (req, res) => {
    const customerId = req.user.CustomerID;
    const { productId, quantity, unitPrice, rushOrder } = req.body;
    if (productId === undefined || quantity === undefined || unitPrice === undefined || rushOrder === undefined) {
        return res.status(400).json({ message: 'Product ID, quantity, unit price, and rush order status are required.' });
    }
    const numQuantity = parseInt(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) {
        return res.status(400).json({ message: 'Quantity must be a positive number.' });
    }
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [existingItems] = await connection.execute(
            'SELECT * FROM `cart_items` WHERE `CustomerID` = ? AND `ProductID` = ? AND `RushOrder` = ?',
            [customerId, productId, rushOrder ? 1 : 0]
        );
        let cartItemId; let finalQuantity = numQuantity; let actionMessage = ''; let statusCode = 200;
        if (existingItems.length > 0) {
            const existingItem = existingItems[0];
            finalQuantity = existingItem.Quantity + numQuantity; 
            cartItemId = existingItem.ID;
            await connection.execute('UPDATE `cart_items` SET `Quantity` = ? WHERE `ID` = ?', [finalQuantity, cartItemId]);
            actionMessage = 'Cart item quantity updated.';
        } else {
            const [result] = await connection.execute(
                'INSERT INTO `cart_items` (`CustomerID`, `ProductID`, `Quantity`, `Price`, `RushOrder`) VALUES (?, ?, ?, ?, ?)',
                [customerId, productId, finalQuantity, parseFloat(unitPrice), rushOrder ? 1 : 0]
            );
            cartItemId = result.insertId; actionMessage = 'Item added to cart.'; statusCode = 201;
        }
        await connection.commit();
        const [itemDetails] = await connection.execute(
             `SELECT ci.ID as CartItemID, ci.ProductID, ci.Quantity, ci.Price as UnitPrice, ci.RushOrder,
                     p.Name, p.ImagePath, p.Description, p.ItemType, p.Material, p.Stock
              FROM cart_items ci JOIN products p ON ci.ProductID = p.ProductID WHERE ci.ID = ?`, [cartItemId]
        );
        if (itemDetails.length === 0) throw new Error("Failed to retrieve item details after cart operation.");
        res.status(statusCode).json({ message: actionMessage, item: itemDetails[0] });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding/updating cart item:', error);
        res.status(500).json({ message: 'Failed to process cart item.' });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/cart/items/:cartItemId', authenticateUser, async (req, res) => {
    const customerId = req.user.CustomerID;
    const { cartItemId } = req.params; 
    const { quantity } = req.body;
    if (quantity === undefined || parseInt(quantity) <= 0) {
        return res.status(400).json({ message: 'Valid quantity is required.' });
    }
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.execute(
            'UPDATE `cart_items` SET `Quantity` = ? WHERE `ID` = ? AND `CustomerID` = ?',
            [parseInt(quantity), cartItemId, customerId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: "Cart item not found or user mismatch." });
        const [updatedItemDetails] = await connection.execute(
             `SELECT ci.ID as CartItemID, ci.ProductID, ci.Quantity, ci.Price as UnitPrice, ci.RushOrder,
                     p.Name, p.ImagePath, p.Description, p.ItemType, p.Material, p.Stock
              FROM cart_items ci JOIN products p ON ci.ProductID = p.ProductID WHERE ci.ID = ?`, [cartItemId]
        );
        res.status(200).json({ message: 'Cart item quantity updated.', item: updatedItemDetails[0] });
    } catch (error) {
        console.error('Error updating cart item:', error);
        res.status(500).json({ message: 'Failed to update cart item.' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/cart/items/:cartItemId', authenticateUser, async (req, res) => {
    const customerId = req.user.CustomerID;
    const { cartItemId } = req.params;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.execute(
            'DELETE FROM `cart_items` WHERE `ID` = ? AND `CustomerID` = ?',
            [cartItemId, customerId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: "Cart item not found or user mismatch." });
        res.status(200).json({ message: 'Item removed from cart.' });
    } catch (error) {
        console.error('Error removing cart item:', error);
        res.status(500).json({ message: 'Failed to remove item from cart.' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/cart', authenticateUser, async (req, res) => {
    const customerId = req.user.CustomerID;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.execute('DELETE FROM `cart_items` WHERE `CustomerID` = ?', [customerId]);
        res.status(200).json({ message: 'Cart cleared successfully.' });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ message: 'Failed to clear cart.' });
    } finally {
        if (connection) connection.release();
    }
});


// --- Default Route ---
app.get('/', (req, res) => {
  res.send('Welcome to the Metalworks API!');
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  console.log(`Accepting requests from: ${REACT_APP_FRONTEND_URL}`);
});
