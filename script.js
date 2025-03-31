// Import store data
import { testStores } from './storeData.js';

// Initialize variables
const radiusInput = document.getElementById('radius-input');
const storeSelect = document.getElementById('store-select');
const searchButton = document.getElementById('search-button');
const resultsContainer = document.getElementById('results-container');
const coordinatesDisplay = document.getElementById('coordinates-display');
const groceryItemInput = document.getElementById('grocery-item-input');
const addItemButton = document.getElementById('add-item-button');
const groceryList = document.getElementById('grocery-list');
const locationButton = document.getElementById('location-button');

// Add user location tracking
let userLocation = null;
let userGroceryList = new Set(); // Store unique items

// Function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in miles
}

// Function to get user's location
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                coordinatesDisplay.textContent = `Lat: ${userLocation.lat.toFixed(4)}, Long: ${userLocation.lng.toFixed(4)}`;
                resolve(userLocation);
            },
            (error) => {
                console.error('Error getting location:', error);
                reject(error);
            }
        );
    });
}

// Event listener for location button
locationButton.addEventListener('click', async () => {
    try {
        locationButton.disabled = true;
        locationButton.textContent = 'Getting location...';
        await getUserLocation();
        updateStoreDistances();
        locationButton.textContent = 'Location Found';
    } catch (error) {
        locationButton.textContent = 'Error getting location';
        locationButton.disabled = false;
    }
});

// Function to update store distances based on user location
function updateStoreDistances() {
    if (!userLocation) return;

    testStores.forEach(store => {
        store.distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            store.location.lat,
            store.location.lng
        );
    });
}

// Function to convert miles to meters
function milesToMeters(miles) {
    return miles * 1609.34;
}

// Function to format item name for display and matching
function formatItemName(name) {
    // Convert to lowercase and trim spaces
    name = name.toLowerCase().trim();
    
    // Convert spaces to camelCase
    // e.g., "organic chopped kale" -> "organicChoppedKale"
    return name.replace(/\s+(.)/g, (match, letter) => letter.toUpperCase());
}

// Function to format item for display
function formatItemForDisplay(camelCaseName) {
    // Convert camelCase back to spaced words
    // e.g., "organicChoppedKale" -> "Organic Chopped Kale"
    return camelCaseName
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .trim(); // Remove any extra spaces
}

// Function to add item to grocery list
function addGroceryItem() {
    const itemInput = groceryItemInput.value.trim();
    if (itemInput) {
        const camelCaseName = formatItemName(itemInput);
        userGroceryList.add(camelCaseName);
        updateGroceryListDisplay();
        groceryItemInput.value = ''; // Clear input
    }
}

// Function to remove item from grocery list
function removeGroceryItem(item) {
    userGroceryList.delete(item);
    updateGroceryListDisplay();
}

// Function to update grocery list display
function updateGroceryListDisplay() {
    groceryList.innerHTML = '';
    userGroceryList.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'grocery-item';
        itemElement.innerHTML = `
            <span>${formatItemForDisplay(item)}</span>
            <button class="remove-item" onclick="removeGroceryItem('${item}')">&times;</button>
        `;
        groceryList.appendChild(itemElement);
    });
}

// Add event listeners for grocery list
addItemButton.addEventListener('click', addGroceryItem);
groceryItemInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addGroceryItem();
    }
});

// Modify the calculate total cost function to only include selected items
function calculateTotalCost(storePrices) {
    const costs = {};
    let total = 0;
    
    // If user has a grocery list, only calculate costs for those items
    if (userGroceryList.size > 0) {
        userGroceryList.forEach(item => {
            if (storePrices[item] !== undefined) {
                costs[item] = storePrices[item];
                total += storePrices[item];
            } else {
                costs[item] = null; // Item not available at this store
            }
        });
    } else {
        // If no grocery list, include all items
        for (const [item, price] of Object.entries(storePrices)) {
            costs[item] = price;
            total += price;
        }
    }
    
    costs.total = total;
    return costs;
}

// Modify the find best prices function to only consider selected items
function findBestPrices(stores) {
    const items = userGroceryList.size > 0 ? 
        Array.from(userGroceryList) : 
        Array.from(new Set(stores.flatMap(store => Object.keys(store.prices))));

    const bestPrices = {};
    items.forEach(item => {
        bestPrices[item] = { price: Infinity, store: null };
    });

    stores.forEach(store => {
        for (const item of items) {
            const price = store.prices[item];
            if (price !== undefined && price < bestPrices[item].price) {
                bestPrices[item] = {
                    price: price,
                    store: store.name,
                    distance: store.distance
                };
            }
        }
    });

    return bestPrices;
}

// Function to calculate total optimal cost
function calculateOptimalCost(stores) {
    const bestPrices = findBestPrices(stores);
    const total = Object.values(bestPrices).reduce((sum, item) => sum + item.price, 0);
    
    // Create a map of which stores to visit and what to buy there
    const shoppingPlan = {};
    for (const [item, details] of Object.entries(bestPrices)) {
        if (!shoppingPlan[details.store]) {
            shoppingPlan[details.store] = {
                items: [],
                distance: details.distance,
                totalCost: 0
            };
        }
        shoppingPlan[details.store].items.push({
            name: item,
            price: details.price
        });
        shoppingPlan[details.store].totalCost += details.price;
    }

    return {
        bestPrices,
        total,
        shoppingPlan
    };
}

// Function to adjust distance based on rounding rule
function adjustDistance(actualDistance) {
    const wholeMile = Math.floor(actualDistance);
    const decimal = actualDistance - wholeMile;
    
    // If the decimal part is less than 0.3, round down to the whole mile
    if (decimal < 0.3) {
        return wholeMile;
    }
    return actualDistance;
}

// Function to find cheapest store within radius
function findCheapestStore(maxDistance, maxStores) {
    // First, get ALL stores within the specified radius, using adjusted distances
    const storesInRange = testStores.filter(store => {
        const adjustedDistance = adjustDistance(store.distance);
        return adjustedDistance <= maxDistance;
    });
    
    if (storesInRange.length === 0) {
        return null;
    }

    // Sort stores by total cost to find the best options
    const sortedStores = storesInRange.map(store => ({
        name: store.name,
        distance: store.distance,
        adjustedDistance: adjustDistance(store.distance),
        costs: calculateTotalCost(store.prices),
        prices: store.prices
    })).sort((a, b) => a.costs.total - b.costs.total);

    // Take only the number of stores specified
    const selectedStores = sortedStores.slice(0, maxStores);

    // Calculate optimal shopping plan using only selected stores
    const optimalShopping = calculateOptimalCost(selectedStores.map(store => ({
        name: store.name,
        distance: store.distance,
        prices: store.prices
    })));

    return {
        singleStoreCosts: selectedStores,
        optimalShopping,
        storesChecked: storesInRange.length
    };
}

// Function to search for nearby stores
async function searchNearbyStores() {
    const radius = parseInt(radiusInput.value) || 5;
    const maxStores = parseInt(storeSelect.value) || 5;

    // Use test data with updated distances
    const results = findCheapestStore(radius, maxStores);
    
    if (results) {
        displayTestResults(results, radius);
    } else {
        resultsContainer.innerHTML = 'No stores found within the specified radius.';
        resultsContainer.style.display = 'block';
    }
}

// Update display function to highlight missing items
function displayTestResults(results, searchRadius) {
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'block';

    // Display optimal shopping plan
    const optimalElement = document.createElement('div');
    optimalElement.className = 'summary optimal-plan';
    optimalElement.innerHTML = `
        <h2>Optimal Shopping Plan (${results.storesChecked} stores within ${searchRadius} miles)</h2>
        <h3>Total Cost: $${results.optimalShopping.total.toFixed(2)}</h3>
        <div class="shopping-plan">
            ${Object.entries(results.optimalShopping.shoppingPlan).map(([store, plan]) => `
                <div class="store-plan">
                    <h4>${store} (${plan.distance.toFixed(1)} miles)</h4>
                    <ul>
                        ${plan.items.map(item => `
                            <li>${item.name}: $${item.price.toFixed(2)}</li>
                        `).join('')}
                    </ul>
                    <p>Store subtotal: $${plan.totalCost.toFixed(2)}</p>
                </div>
            `).join('')}
        </div>
    `;
    resultsContainer.appendChild(optimalElement);

    // Display single-store comparison table
    const tableElement = document.createElement('div');
    tableElement.className = 'price-comparison';
    
    // Use grocery list items if available, otherwise use all items
    const itemsToDisplay = userGroceryList.size > 0 ? 
        Array.from(userGroceryList) : 
        Array.from(new Set(results.singleStoreCosts.flatMap(store => 
            Object.keys(store.costs).filter(item => item !== 'total')
        )));

    tableElement.innerHTML = `
        <h3>Single Store Options:</h3>
        <table>
            <tr>
                <th>Store</th>
                <th>Distance</th>
                ${itemsToDisplay.map(item => 
                    `<th>${item}</th>`
                ).join('')}
                <th>Total</th>
            </tr>
            ${results.singleStoreCosts.map(store => `
                <tr>
                    <td>${store.name}</td>
                    <td>${store.distance.toFixed(1)} mi</td>
                    ${itemsToDisplay.map(item => {
                        const price = store.costs[item];
                        const cellClass = price === null ? 'missing-item' : '';
                        return `<td class="${cellClass}">${price !== null ? '$' + price.toFixed(2) : 'N/A'}</td>`;
                    }).join('')}
                    <td>$${store.costs.total.toFixed(2)}</td>
                </tr>
            `).join('')}
        </table>
    `;
    resultsContainer.appendChild(tableElement);
}

// Add event listener to search button
searchButton.addEventListener('click', searchNearbyStores);

// Add event listener for enter key on inputs
locationInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchNearbyStores();
});

radiusInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchNearbyStores();
}); 