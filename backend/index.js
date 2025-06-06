// METALWORKS/backend/index.js

// Import necessary modules
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
const REACT_APP_FRONTEND_URL = process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000';

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
  database: process.env.DB_NAME || 'metalworks', // Using 'metalworks' as per this file
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

// --- Authentication Middleware (Placeholder - Updated for stricter checking) ---
const authenticateUser = (req, res, next) => {
  const userIdFromHeader = req.headers['temp-user-id'];

  if (userIdFromHeader && !isNaN(parseInt(userIdFromHeader))) {
    req.user = { CustomerID: parseInt(userIdFromHeader) };
    console.log(`Authenticated (temp) user: CustomerID ${req.user.CustomerID}`);
    return next();
  } else {
    const protectedPaths = ['/api/cart', '/api/user', '/api/orders'];
    const requiresAuth = protectedPaths.some(p => req.path.startsWith(p));

    if (requiresAuth) {
      console.warn(`WARN: Missing or invalid 'temp-user-id' header for protected route ${req.path}. Denying access.`);
      return res.status(401).json({ message: "User not identified or invalid user ID. Please send a valid 'temp-user-id' header or ensure you are logged in." });
    }

    console.warn(`WARN: No valid 'temp-user-id' header for ${req.path}. Proceeding without setting req.user from header for this route (if route doesn't strictly require it).`);
    return next();
  }
};


// --- API Routes ---

// AUTH Routes (Signup, Login) - These should NOT use authenticateUser middleware here.
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
    const [rows] = await connection.execute('SELECT `CustomerID` FROM `customer` WHERE `userEmail` = ?', [userEmail]);
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

app.post('/api/auth/login', async (req, res) => {
  const { userEmail, password } = req.body;
  if (!userEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  let connection;
  try {
    connection = await dbPool.getConnection();
    const [rows] = await connection.execute('SELECT `CustomerID`, `firstName`, `lastName`, `userEmail`, `password_hash`, `PhoneNumber` FROM `customer` WHERE `userEmail` = ?', [userEmail]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const user = rows[0];
    const passwordIsValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const userDataForFrontend = {
      CustomerID: user.CustomerID,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.userEmail,
      phone: user.PhoneNumber || ''
    };
    // IMPORTANT: Replace "fake-auth-token..." with actual JWT generation
    const token = "fake-auth-token-replace-with-real-jwt";
    res.status(200).json({ message: 'Login successful!', user: userDataForFrontend, token: token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during login. Please try again.' });
  } finally {
    if (connection) connection.release();
  }
});

// PRODUCT Routes (Public)
app.get('/api/products', async (req, res) => {
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
app.get('/api/products/:id', async (req, res) => {
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
app.get('/api/products/search', async (req, res) => {
  const searchTerm = req.query.q;
  const page = 1; 
  const limit = 100; 
  const offset = (page - 1) * limit;

  if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
    return res.status(400).json({ message: 'Search term is required.' });
  }
  let connection;
  try {
    connection = await dbPool.getConnection();
    const searchPattern = `%${searchTerm.trim()}%`;

    const countQuery = `
      SELECT COUNT(*) as total FROM products 
      WHERE Name LIKE ? OR Description LIKE ? OR ItemType LIKE ? OR Material LIKE ?
    `;
    const [countResult] = await connection.execute(countQuery, [searchPattern, searchPattern, searchPattern, searchPattern]);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const resultsQuery = `
      SELECT * FROM products 
      WHERE Name LIKE ? OR Description LIKE ? OR ItemType LIKE ? OR Material LIKE ?
      ORDER BY Name ASC
      LIMIT ? OFFSET ? 
    `;
    const [results] = await connection.execute(resultsQuery, [searchPattern, searchPattern, searchPattern, searchPattern, limit, offset]);

    console.log(`Search for "${searchTerm}" returned ${results.length} products (total matching: ${total}).`);

    res.status(200).json({
      results: results,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('Error during product search:', error);
    res.status(500).json({ message: 'Failed to search for products.' });
  } finally {
    if (connection) connection.release();
  }
});

// ORDER Route (Requires authentication)
app.post('/api/orders', authenticateUser, async (req, res) => {
  if (!req.user || !req.user.CustomerID) {
    return res.status(401).json({ message: "User authentication failed for order placement." });
  }
  const customerId = req.user.CustomerID;
  const { items: itemsInPayload, paymentMethod, finalTotal, isRushOrder, messageForSeller, deliveryAddress } = req.body;

  if (!itemsInPayload || itemsInPayload.length === 0) return res.status(400).json({ message: 'Order must contain at least one item.' });
  if (!paymentMethod || finalTotal === undefined) return res.status(400).json({ message: 'Payment method and total amount are required.' });
  if (!deliveryAddress || !deliveryAddress.line1 || !deliveryAddress.city || !deliveryAddress.postalCode || !deliveryAddress.country || !deliveryAddress.recipientName || !deliveryAddress.contactPhone) {
    return res.status(400).json({ message: 'Complete delivery address including recipient name and phone is required.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();
    const orderDate = new Date().toISOString().slice(0, 10);
    const rushOrderText = isRushOrder ? '1' : '0';
    const approvalStatus = 'Pending';

    const [orderResult] = await connection.execute(
      'INSERT INTO `order` (`CustomerID`, `OrderDate`, `RushOrder`, `ApprovalStatus`, `TotalCost`, `OrderNotes`, `ShippingRecipientName`, `ShippingAddressLine1`, `ShippingAddressLine2`, `ShippingCity`, `ShippingPostalCode`, `ShippingCountry`, `ShippingContactPhone`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [customerId, orderDate, rushOrderText, approvalStatus, finalTotal, messageForSeller || null,
        deliveryAddress.recipientName, deliveryAddress.line1, deliveryAddress.line2 || null,
        deliveryAddress.city, deliveryAddress.postalCode, deliveryAddress.country, deliveryAddress.contactPhone
      ]
    );
    const newOrderId = orderResult.insertId;

    for (const cartItem of itemsInPayload) {
      const itemTotalCost = (Number(cartItem.unitPrice) || 0) * (cartItem.quantity || 1);
      const placeholderPricingTierID = 0;
      await connection.execute(
        'INSERT INTO `item` (`OrderID`, `PricingTierID`, `UnitPrice`, `TotalCost`, `Quantity`, `ProductID`) VALUES (?, ?, ?, ?, ?, ?)',
        [newOrderId, placeholderPricingTierID, cartItem.unitPrice, itemTotalCost, cartItem.quantity, cartItem.productId]
      );

      // --- BEGIN STOCK UPDATE ---
      const productIdToUpdate = parseInt(cartItem.productId);
      const quantityOrdered = parseInt(cartItem.quantity);

      if (isNaN(productIdToUpdate) || isNaN(quantityOrdered) || quantityOrdered <= 0) {
        throw new Error(`Invalid product ID or quantity for stock update: ProductID ${cartItem.productId}, Quantity ${cartItem.quantity}`);
      }

      // Update stock, ensuring it doesn't go negative by checking current stock
      const [stockUpdateResult] = await connection.execute(
        'UPDATE `products` SET `Stock` = `Stock` - ? WHERE `ProductID` = ? AND `Stock` >= ?',
        [quantityOrdered, productIdToUpdate, quantityOrdered]
      );

      if (stockUpdateResult.affectedRows === 0) {
        // Check if the product exists to differentiate between "not found" and "insufficient stock"
        const [productCheck] = await connection.execute('SELECT Stock FROM `products` WHERE `ProductID` = ?', [productIdToUpdate]);
        if (productCheck.length > 0 && productCheck[0].Stock < quantityOrdered) {
             throw new Error(`Insufficient stock for ProductID ${productIdToUpdate}. Available: ${productCheck[0].Stock}, Requested: ${quantityOrdered}`);
        }
        // If product doesn't exist or other reason for update failure (e.g., stock became insufficient between check and update, though less likely with `Stock >= ?`)
        throw new Error(`Failed to update stock for ProductID ${productIdToUpdate}. Product may not exist or stock may have been insufficient.`);
      }
      console.log(`Stock updated for ProductID ${productIdToUpdate}, quantity reduced by ${quantityOrdered}`);
      // --- END STOCK UPDATE ---
    }

    const paymentAddressPlaceholder = "Order Payment - Address N/A";
    const placeholderOriginalPaymentID = newOrderId; // Or 0 if that's the intent for a placeholder
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
     // Send a more specific error message to the client if it's a stock issue or known validation failure
    if (error.message.includes('Insufficient stock') || error.message.includes('Failed to update stock')) {
        return res.status(409).json({ message: error.message }); // 409 Conflict for stock issues
    }
    if (error.message.includes('Invalid product ID or quantity')) {
        return res.status(400).json({message: error.message });
    }
    res.status(500).json({ message: 'Failed to place order. Please check server logs for specific database errors.' });
  } finally {
    if (connection) connection.release();
  }
});


// USER-SPECIFIC CART API Routes (all use authenticateUser)
app.get('/api/cart', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not properly authenticated for cart." });
    const customerId = req.user.CustomerID;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [cartDbItems] = await connection.execute(
            `SELECT ci.ID as CartItemID, ci.ProductID, ci.Quantity, ci.Price as UnitPrice, ci.RushOrder,
                    p.Name, p.ImagePath, p.Description, p.ItemType, p.Material, p.Stock
             FROM cart_items ci JOIN products p ON ci.ProductID = p.ProductID WHERE ci.CustomerID = ?`,
            [customerId]
        );
        res.status(200).json(cartDbItems);
    } catch (error) {
        console.error(`Error fetching cart for CustomerID ${customerId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve cart.' });
    } finally { if (connection) connection.release(); }
});
app.post('/api/cart/items', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not properly authenticated for cart." });
    const customerId = req.user.CustomerID;
    const { productId, quantity, unitPrice, rushOrder } = req.body;
    if (productId === undefined || quantity === undefined || unitPrice === undefined || rushOrder === undefined) {
        return res.status(400).json({ message: 'Product ID, quantity, unit price, and rush order status are required.' });
    }
    const numQuantity = parseInt(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) return res.status(400).json({ message: 'Quantity must be a positive number.' });
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
            const existingItem = existingItems[0]; finalQuantity = existingItem.Quantity + numQuantity;
            cartItemId = existingItem.ID;
            await connection.execute('UPDATE `cart_items` SET `Quantity` = ? WHERE `ID` = ? AND `CustomerID` = ?', [finalQuantity, cartItemId, customerId]);
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
              FROM cart_items ci JOIN products p ON ci.ProductID = p.ProductID WHERE ci.ID = ? AND ci.CustomerID = ?`, [cartItemId, customerId]
        );
        if (itemDetails.length === 0) throw new Error("Failed to retrieve item details after cart operation.");
        res.status(statusCode).json({ message: actionMessage, item: itemDetails[0] });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding/updating cart item:', error);
        res.status(500).json({ message: 'Failed to process cart item.' });
    } finally { if (connection) connection.release(); }
});
app.put('/api/cart/items/:cartItemId', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not properly authenticated for cart." });
    const customerId = req.user.CustomerID;
    const { cartItemId } = req.params;
    const { quantity } = req.body;
    if (quantity === undefined || parseInt(quantity) <= 0) return res.status(400).json({ message: 'Valid quantity is required.' });
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
              FROM cart_items ci JOIN products p ON ci.ProductID = p.ProductID WHERE ci.ID = ? AND ci.CustomerID = ?`, [cartItemId, customerId]
        );
        res.status(200).json({ message: 'Cart item quantity updated.', item: updatedItemDetails[0] });
    } catch (error) {
        console.error('Error updating cart item:', error);
        res.status(500).json({ message: 'Failed to update cart item.' });
    } finally { if (connection) connection.release(); }
});
app.delete('/api/cart/items/:cartItemId', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not properly authenticated for cart." });
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
    } finally { if (connection) connection.release(); }
});
app.delete('/api/cart', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not properly authenticated for cart." });
    const customerId = req.user.CustomerID;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.execute('DELETE FROM `cart_items` WHERE `CustomerID` = ?', [customerId]);
        res.status(200).json({ message: 'Cart cleared successfully.' });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ message: 'Failed to clear cart.' });
    } finally { if (connection) connection.release(); }
});


// USER PROFILE & DASHBOARD API Routes
app.get('/api/user/profile', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not properly authenticated." });
    const customerId = req.user.CustomerID;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.execute(
            'SELECT CustomerID, firstName, lastName, userEmail, PhoneNumber, AvatarURL FROM `customer` WHERE `CustomerID` = ?',
            [customerId]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'User profile not found.' });
        const userProfile = rows[0];
        res.status(200).json({
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            email: userProfile.userEmail,
            phone: userProfile.PhoneNumber || '',
            avatarUrl: userProfile.AvatarURL || ''
        });
    } catch (error) {
        console.error(`Error fetching profile for CustomerID ${customerId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve user profile.' });
    } finally { if (connection) connection.release(); }
});

app.put('/api/user/profile', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not properly authenticated." });
    const customerId = req.user.CustomerID;
    const { firstName, lastName, phone } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ message: 'First name and last name are required.' });
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.execute(
            'UPDATE `customer` SET `firstName` = ?, `lastName` = ?, `PhoneNumber` = ? WHERE `CustomerID` = ?',
            [firstName, lastName, phone || null, customerId]
        );
        const [updatedRows] = await connection.execute(
             'SELECT CustomerID, firstName, lastName, userEmail, PhoneNumber, AvatarURL FROM `customer` WHERE `CustomerID` = ?',
            [customerId]
        );
        const updatedProfile = updatedRows[0];
        res.status(200).json({
            message: 'Profile updated successfully.',
            user: {
                firstName: updatedProfile.firstName,
                lastName: updatedProfile.lastName,
                email: updatedProfile.userEmail,
                phone: updatedProfile.PhoneNumber || '',
                avatarUrl: updatedProfile.AvatarURL || ''
            }
        });
    } catch (error) {
        console.error(`Error updating profile for CustomerID ${customerId}:`, error);
        res.status(500).json({ message: 'Failed to update profile.' });
    } finally { if (connection) connection.release(); }
});

app.put('/api/user/avatar', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) {
        return res.status(401).json({ message: "User not properly authenticated." });
    }
    const customerId = req.user.CustomerID;
    const { avatarUrl } = req.body;

    if (typeof avatarUrl !== 'string') {
        return res.status(400).json({ message: "Avatar URL must be a string." });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.execute(
            'UPDATE `customer` SET `AvatarURL` = ? WHERE `CustomerID` = ?',
            [avatarUrl.trim() || null, customerId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        res.status(200).json({ message: 'Avatar updated successfully.', avatarUrl: avatarUrl.trim() || null });
    } catch (error) {
        console.error(`Error updating avatar for CustomerID ${customerId}:`, error);
        res.status(500).json({ message: 'Failed to update avatar.' });
    } finally {
        if (connection) connection.release();
    }
});
app.post('/api/user/password', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not properly authenticated." });
    const customerId = req.user.CustomerID;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new password are required.' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 chars.' });
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.execute('SELECT password_hash FROM `customer` WHERE `CustomerID` = ?', [customerId]);
        if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });
        const user = rows[0];
        const currentPasswordIsValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!currentPasswordIsValid) return res.status(401).json({ message: 'Incorrect current password.' });
        const saltRounds = 10;
        const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await connection.execute(
            'UPDATE `customer` SET `password_hash` = ? WHERE `CustomerID` = ?',
            [newHashedPassword, customerId]
        );
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error(`Error changing password for CustomerID ${customerId}:`, error);
        res.status(500).json({ message: 'Failed to change password.' });
    } finally { if (connection) connection.release(); }
});
app.get('/api/user/orders', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not properly authenticated." });
    const customerId = req.user.CustomerID;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [orders] = await connection.execute(
            'SELECT OrderID, OrderDate, TotalCost, ApprovalStatus as Status FROM `order` WHERE `CustomerID` = ? ORDER BY OrderDate DESC',
            [customerId]
        );
        const ordersWithItems = await Promise.all(orders.map(async (order) => {
            const [items] = await connection.execute(
                `SELECT i.Quantity, i.UnitPrice, p.Name as ProductName, p.ImagePath, p.ProductID 
                 FROM item i JOIN products p ON i.ProductID = p.ProductID WHERE i.OrderID = ?`,
                [order.OrderID]
            );
            return {
                id: order.OrderID, date: order.OrderDate, total: order.TotalCost, status: order.Status,
                items: items.map(it => ({
                    id: it.ProductID, name: it.ProductName, price: it.UnitPrice, quantity: it.Quantity,
                    imagePath: it.ImagePath
                }))
            };
        }));
        res.status(200).json(ordersWithItems);
    } catch (error) {
        console.error(`Error fetching order history for CustomerID ${customerId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve order history.' });
    } finally { if (connection) connection.release(); }
});

// ADDRESS API Routes
app.get('/api/user/addresses', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) {
        return res.status(401).json({ message: "User not authenticated." });
    }
    const customerId = req.user.CustomerID;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [addresses] = await connection.execute(
            'SELECT * FROM `customer_addresses` WHERE `CustomerID` = ? ORDER BY `IsDefault` DESC, `AddressID` ASC',
            [customerId]
        );
        res.status(200).json(addresses);
    } catch (error) {
        console.error(`Error fetching addresses for CustomerID ${customerId}:`, error);
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(501).json({message: "Addresses feature not fully set up (table missing)."});
        }
        res.status(500).json({ message: 'Failed to retrieve addresses.' });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/user/addresses', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) {
        return res.status(401).json({ message: "User not authenticated." });
    }
    const customerId = req.user.CustomerID;
    const { Nickname, RecipientName, ContactPhone, Line1, Line2, City, Region, PostalCode, Country, IsDefault } = req.body;

    if (!RecipientName || !ContactPhone || !Line1 || !City || !PostalCode || !Country) {
        return res.status(400).json({ message: 'Recipient name, phone, address line 1, city, postal code, and country are required.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        if (IsDefault) { // If this new address is set to default, unset others
            await connection.execute(
                'UPDATE `customer_addresses` SET `IsDefault` = FALSE WHERE `CustomerID` = ?',
                [customerId]
            );
        }

        const [result] = await connection.execute(
            'INSERT INTO `customer_addresses` (`CustomerID`, `Nickname`, `RecipientName`, `ContactPhone`, `Line1`, `Line2`, `City`, `Region`, `PostalCode`, `Country`, `IsDefault`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [customerId, Nickname || null, RecipientName, ContactPhone, Line1, Line2 || null, City, Region || null, PostalCode, Country, IsDefault ? 1 : 0]
        );
        const newAddressId = result.insertId;
        await connection.commit();

        const [newAddress] = await connection.execute('SELECT * FROM `customer_addresses` WHERE `AddressID` = ?', [newAddressId]);
        res.status(201).json({ message: 'Address added successfully.', address: newAddress[0] });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Error adding address for CustomerID ${customerId}:`, error);
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(501).json({message: "Addresses feature not fully set up (table missing)."});
        }
        res.status(500).json({ message: 'Failed to add address.' });
    } finally {
        if (connection) connection.release();
    }
});

// Using the more complete PUT, DELETE, Set Default Address from the previous version you provided
app.put('/api/user/addresses/:addressId', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not authenticated." });
    const customerId = req.user.CustomerID;
    const { addressId } = req.params;
    const { Nickname, RecipientName, ContactPhone, Line1, Line2, City, Region, PostalCode, Country, IsDefault } = req.body;

    if (!RecipientName || !ContactPhone || !Line1 || !City || !PostalCode || !Country) {
        return res.status(400).json({ message: 'Required address fields are missing.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        if (IsDefault) { 
            await connection.execute(
                'UPDATE `customer_addresses` SET `IsDefault` = FALSE WHERE `CustomerID` = ? AND `AddressID` != ?',
                [customerId, addressId]
            );
        }

        const [result] = await connection.execute(
            'UPDATE `customer_addresses` SET `Nickname`=?, `RecipientName`=?, `ContactPhone`=?, `Line1`=?, `Line2`=?, `City`=?, `Region`=?, `PostalCode`=?, `Country`=?, `IsDefault`=? WHERE `AddressID` = ? AND `CustomerID` = ?',
            [Nickname || null, RecipientName, ContactPhone, Line1, Line2 || null, City, Region || null, PostalCode, Country, IsDefault ? 1 : 0, addressId, customerId]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Address not found or user mismatch." });
        }

        await connection.commit();
        const [updatedAddress] = await connection.execute('SELECT * FROM `customer_addresses` WHERE `AddressID` = ?', [addressId]);
        res.status(200).json({ message: "Address updated successfully", address: updatedAddress[0] });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Error updating address ${addressId} for CustomerID ${customerId}:`, error);
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(501).json({message: "Addresses feature not fully set up (table missing)."});
        }
        res.status(500).json({ message: 'Failed to update address.' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/user/addresses/:addressId', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not authenticated." });
    const customerId = req.user.CustomerID;
    const { addressId } = req.params;

    let connection;
    try {
        connection = await dbPool.getConnection();
        const [addressCheck] = await connection.execute(
            'SELECT `IsDefault` FROM `customer_addresses` WHERE `AddressID` = ? AND `CustomerID` = ?',
            [addressId, customerId]
        );

        if (addressCheck.length === 0) {
            return res.status(404).json({ message: "Address not found or user mismatch." });
        }

        const [result] = await connection.execute(
            'DELETE FROM `customer_addresses` WHERE `AddressID` = ? AND `CustomerID` = ?',
            [addressId, customerId]
        );

        if (result.affectedRows === 0) {
             return res.status(404).json({ message: "Address not found or user mismatch (already deleted?)." });
        }
        res.status(200).json({ message: "Address deleted successfully" });
    } catch (error) {
        console.error(`Error deleting address ${addressId} for CustomerID ${customerId}:`, error);
         if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(501).json({message: "Addresses feature not fully set up (table missing)."});
        }
        res.status(500).json({ message: 'Failed to delete address.' });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/user/addresses/:addressId/default', authenticateUser, async (req, res) => {
    if (!req.user || !req.user.CustomerID) return res.status(401).json({ message: "User not authenticated." });
    const customerId = req.user.CustomerID;
    const { addressId } = req.params;

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        await connection.execute(
            'UPDATE `customer_addresses` SET `IsDefault` = FALSE WHERE `CustomerID` = ?',
            [customerId]
        );

        const [result] = await connection.execute(
            'UPDATE `customer_addresses` SET `IsDefault` = TRUE WHERE `AddressID` = ? AND `CustomerID` = ?',
            [addressId, customerId]
        );
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Address not found or user mismatch." });
        }

        await connection.commit();
        res.status(200).json({ message: "Address set as default successfully" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Error setting address ${addressId} as default for CustomerID ${customerId}:`, error);
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(501).json({message: "Addresses feature not fully set up (table missing)."});
        }
        res.status(500).json({ message: 'Failed to set default address.' });
    } finally {
        if (connection) connection.release();
    }
});


// --- Default Route & Start Server ---
app.get('/', (req, res) => {
  res.send('Welcome to the Metalworks API!');
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  console.log(`Accepting requests from: ${REACT_APP_FRONTEND_URL}`);
});