// src/data/CartProvider.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthProvider'; // Ensure this path is correct

// Import the centralized productImages map from your utils folder
// Path is relative from src/data/ to src/utils/
import { productImages } from '../utils/productImages'; // <--- IMPORTED HERE

// Local image imports and imageMap definition are removed from here.
// All image mapping logic now relies on the imported 'productImages' object.

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false); 
  const [error, setError] = useState(null);       
  const { isAuthenticated, user, isLoading: authIsLoading } = useAuth();

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (isAuthenticated && user?.CustomerID) {
      headers['temp-user-id'] = user.CustomerID; // Replace with actual auth token
    }
    return headers;
  };

  const fetchUserCart = useCallback(async () => {
    if (authIsLoading) return;

    if (isAuthenticated && user?.CustomerID) {
      setIsLoading(true);
      setError(null);
      console.log(`CartProvider: Fetching cart for CustomerID: ${user.CustomerID}`);
      try {
        const response = await fetch(`/api/cart`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ message: `Failed to fetch cart. Status: ${response.status}` }));
          throw new Error(errData.message);
        }
        const data = await response.json(); 
        
        const transformedData = data.map(dbItem => ({
          id: dbItem.ProductID,
          cartItemId: dbItem.CartItemID, 
          name: dbItem.Name,
          price: parseFloat(dbItem.UnitPrice), 
          quantity: dbItem.Quantity,
          // Use the imported productImages map here
          image: productImages[dbItem.ImagePath] || productImages['default_placeholder.png'], 
          description: dbItem.Description,
          rushOrder: !!dbItem.RushOrder,
          ItemType: dbItem.ItemType,
          Material: dbItem.Material,
          ImagePath: dbItem.ImagePath,
          Stock: dbItem.Stock,
          totalPrice: (parseFloat(dbItem.UnitPrice) * dbItem.Quantity) * (!!dbItem.RushOrder ? 1.2 : 1)
        }));
        setCartItems(transformedData);
        console.log("CartProvider: User cart fetched and set:", transformedData);
      } catch (err) {
        setError(err.message);
        console.error("CartProvider: API fetchUserCart error:", err);
        setCartItems([]); 
      } finally {
        setIsLoading(false);
      }
    } else {
      console.log("CartProvider: User not authenticated. Loading guest cart.");
      try {
        const localData = localStorage.getItem('metalworksGuestCart');
        const guestItems = localData ? JSON.parse(localData) : [];
        const processedGuestItems = guestItems.map(item => ({
            ...item,
            totalPrice: (Number(item.price) || 0) * (item.quantity || 1) * (item.rushOrder ? 1.2 : 1)
        }));
        setCartItems(processedGuestItems);
        if(localData) console.log("CartProvider: Guest cart loaded from localStorage.");
      } catch (parseError) {
        console.error("CartProvider: Could not parse guest cart from localStorage", parseError);
        setCartItems([]);
      }
    }
  }, [isAuthenticated, user, authIsLoading, API_BASE_URL]); 

  useEffect(() => {
    fetchUserCart();
  }, [fetchUserCart]); 

  useEffect(() => {
    if (!authIsLoading && !isAuthenticated) {
      localStorage.setItem('metalworksGuestCart', JSON.stringify(cartItems));
    } else if (isAuthenticated) {
      // localStorage.removeItem('metalworksGuestCart'); 
    }
  }, [cartItems, isAuthenticated, authIsLoading]);

  const handleAddToCart = useCallback(async (newItem) => {
    if (!newItem || newItem.id === undefined || newItem.price === undefined) {
      setError("Invalid item data."); return;
    }
    
    const itemPayload = {
      productId: newItem.id,
      quantity: newItem.quantity || 1,
      unitPrice: newItem.price, 
      rushOrder: !!newItem.rushOrder
    };

    if (isAuthenticated && user?.CustomerID) {
      setIsLoading(true); setError(null);
      try {
        const response = await fetch(`/api/cart/items`, {
          method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(itemPayload)
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to add item to server cart.');
        }
        await fetchUserCart(); 
      } catch (err) { setError(err.message); console.error("API addToCart error:", err); } 
      finally { setIsLoading(false); }
    } else {
      // Guest cart logic
      setCartItems(prevItems => {
        const existingItem = prevItems.find(item => item.id === newItem.id && item.rushOrder === newItem.rushOrder);
        const calculatedTotalPrice = (Number(newItem.price) || 0) * (newItem.quantity || 1) * (newItem.rushOrder ? 1.2 : 1);
        if (existingItem) {
          return prevItems.map(item =>
            (item.id === newItem.id && item.rushOrder === newItem.rushOrder)
              ? { ...item, quantity: item.quantity + (newItem.quantity || 1), totalPrice: (Number(item.price) * (item.quantity + (newItem.quantity || 1))) * (item.rushOrder ? 1.2 : 1) } 
              : item
          );
        }
        // For guest cart, newItem.image should already be the resolved imported variable from ProductDetail/Page
        return [...prevItems, { ...newItem, quantity: newItem.quantity || 1, totalPrice: calculatedTotalPrice }];
      });
    }
  }, [isAuthenticated, user, fetchUserCart, API_BASE_URL]);

  const handleQuantityChange = useCallback(async (identifier, change) => {
    let itemToUpdateLocally;
    if (isAuthenticated && typeof identifier === 'number') { 
        itemToUpdateLocally = cartItems.find(item => item.cartItemId === identifier);
    } else if (!isAuthenticated && typeof identifier === 'object') { 
        itemToUpdateLocally = cartItems.find(item => item.id === identifier.productId && item.rushOrder === identifier.rushOrder);
    } else if (!isAuthenticated && typeof identifier === 'number') { // Fallback for guest if only id is passed
        itemToUpdateLocally = cartItems.find(item => item.id === identifier);
    }


    if (!itemToUpdateLocally) { console.error(`Item not found for quantity change with identifier:`, identifier); return; }
    const newQuantity = Math.max(1, itemToUpdateLocally.quantity + change);

    if (isAuthenticated && user?.CustomerID && typeof identifier === 'number') { 
      setIsLoading(true); setError(null);
      try {
        const response = await fetch(`/api/cart/items/${identifier}`, {
          method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ quantity: newQuantity }) 
        });
        if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.message || 'Failed to update quantity.');}
        await fetchUserCart(); 
      } catch (err) { setError(err.message); console.error("API quantityChange error:", err); } 
      finally { setIsLoading(false); }
    } else { // Guest cart
      setCartItems(prevItems =>
        prevItems.map(item => {
          if (item.id === itemToUpdateLocally.id && item.rushOrder === itemToUpdateLocally.rushOrder) {
            return { ...item, quantity: newQuantity, totalPrice: item.price * newQuantity * (item.rushOrder ? 1.2 : 1) };
          }
          return item;
        })
      );
    }
  }, [cartItems, isAuthenticated, user, fetchUserCart, API_BASE_URL]);

  const handleRemoveItem = useCallback(async (identifier) => {
    if (isAuthenticated && user?.CustomerID && typeof identifier === 'number') { 
      setIsLoading(true); setError(null);
      try {
        const response = await fetch(`/api/cart/items/${identifier}`, { 
          method: 'DELETE', headers: getAuthHeaders()
        });
        if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.message || 'Failed to remove item.');}
        await fetchUserCart(); 
      } catch (err) { setError(err.message); console.error("API removeItem error:", err); } 
      finally { setIsLoading(false); }
    } else if (!isAuthenticated && typeof identifier === 'object') { 
      setCartItems(prevItems => prevItems.filter(item => !(item.id === identifier.productId && item.rushOrder === identifier.rushOrder)));
    } else { 
        setCartItems(prevItems => prevItems.filter(item => item.id !== identifier)); // Fallback for guest if only id passed
    }
  }, [isAuthenticated, user, fetchUserCart, API_BASE_URL]);

  const clearCart = useCallback(async () => {
    if (isAuthenticated && user?.CustomerID) {
      setIsLoading(true); setError(null);
      try {
        const response = await fetch(`/api/cart`, { 
          method: 'DELETE', headers: getAuthHeaders()
        });
        if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.message || 'Failed to clear cart.');}
        setCartItems([]); 
      } catch (err) { setError(err.message); console.error("API clearCart error:", err); } 
      finally { setIsLoading(false); }
    } else {
      setCartItems([]);
      localStorage.setItem('metalworksGuestCart', JSON.stringify([]));
    }
  }, [isAuthenticated, user, API_BASE_URL]); 

  const cartTotal = cartItems.reduce((total, item) => total + (item.totalPrice || 0), 0);
  const itemCount = cartItems.reduce((count, item) => count + (item.quantity || 0), 0);

  return (
    <CartContext.Provider 
      value={{ 
        cartItems, cartTotal, itemCount, isLoading, error,     
        handleAddToCart, handleQuantityChange, handleRemoveItem,
        clearCart, fetchUserCart 
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
