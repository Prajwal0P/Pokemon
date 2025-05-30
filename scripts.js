// Cache DOM elements
const searchInput = document.getElementById('pokemon-search');
const pokemonGrid = document.getElementById('pokemon-grid');
const suggestionsContainer = document.createElement('div');
suggestionsContainer.className = 'suggestions-container';
searchInput.parentNode.insertBefore(suggestionsContainer, searchInput.nextSibling);

// Type colors mapping
const typeColors = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
    grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
    ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
    rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
    steel: '#B8B8D0', fairy: '#EE99AC'
};

// Cache Pokémon names for autocomplete
let pokemonNames = [];

// Debounce function
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Initialize the app
async function initApp() {
    // Load Pokémon names for autocomplete
    try {
        const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=151');
        const data = await response.json();
        pokemonNames = data.results.map(p => p.name);
    } catch (error) {
        console.error("Failed to load Pokémon names:", error);
    }

    // Event listeners
    searchInput.addEventListener('input', debounce(handleSearchInput, 300));
    searchInput.addEventListener('focus', showSuggestions);
    searchInput.addEventListener('blur', () => setTimeout(() => suggestionsContainer.style.display = 'none', 200));
    window.addEventListener('load', () => {
        setTimeout(() => fetchMultiplePokemon(getRandomPokemonIds(6)), 300);
    });
}

// Main search handler
async function handleSearchInput() {
    const query = searchInput.value.trim().toLowerCase();
    
    // Show suggestions as user types
    if (query.length > 0) {
        showSuggestions();
    } else {
        suggestionsContainer.style.display = 'none';
        fetchMultiplePokemon(getRandomPokemonIds(6));
        return;
    }
    
    // Only search when user stops typing for a bit
    if (query.length > 2) {
        showLoading("Searching...");
        
        try {
            const pokemon = await fetchPokemonData(query);
            displayPokemon([pokemon]);
            suggestionsContainer.style.display = 'none';
        } catch {
            showError("Pokémon not found. Try another name or ID.");
            animateInputError();
        }
    }
}

// Show autocomplete suggestions
function showSuggestions() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query || !pokemonNames.length) {
        suggestionsContainer.style.display = 'none';
        return;
    }

    const matchingNames = pokemonNames
        .filter(name => name.includes(query))
        .slice(0, 5); // Limit to 5 suggestions

    if (matchingNames.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }

    suggestionsContainer.innerHTML = matchingNames
        .map(name => `<div class="suggestion">${capitalize(name)}</div>`)
        .join('');

    suggestionsContainer.style.display = 'block';

    // Add click handlers to suggestions
    suggestionsContainer.querySelectorAll('.suggestion').forEach(suggestion => {
        suggestion.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur before click
            searchInput.value = suggestion.textContent;
            searchInput.focus();
            handleSearchInput();
        });
    });
}

// Fetch multiple Pokémon
async function fetchMultiplePokemon(ids) {
    showLoading("Loading Pokémon...");
    
    try {
        const data = await Promise.all(ids.map(id => fetchPokemonData(id)));
        displayPokemon(data);
    } catch {
        showError("Failed to load Pokémon. Please try again later.");
        animateInputError();
    }
}

// Fetch single Pokémon data
async function fetchPokemonData(idOrName) {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${idOrName}`);
    if (!response.ok) throw new Error("Pokémon not found");
    return response.json();
}

// Fetch weaknesses for Pokémon types
async function fetchWeaknesses(types) {
    const weaknesses = new Set();
    await Promise.all(types.map(async type => {
        const res = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
        const data = await res.json();
        data.damage_relations.double_damage_from.forEach(weak => weaknesses.add(weak.name));
    }));
    return Array.from(weaknesses);
}

// Display Pokémon cards
function displayPokemon(pokemonArray) {
    clearGrid();
    if (!pokemonArray.length) return showError("No Pokémon found.");

    pokemonArray.forEach(async (pokemon, index) => {
        const weaknesses = await fetchWeaknesses(pokemon.types.map(t => t.type.name));
        setTimeout(() => {
            pokemonGrid.appendChild(createPokemonCard(pokemon, weaknesses));
        }, index * 100);
    });
}

// Create Pokémon card element
function createPokemonCard(pokemon, weaknesses) {
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    card.style.animationDelay = `${Math.random() * 0.3}s`;
    
    const stats = ["hp", "attack", "defense"].map(stat => 
        pokemon.stats.find(s => s.stat.name === stat).base_stat
    );
    
    card.innerHTML = `
        <img src="${pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default}" 
             class="pokemon-image" alt="${pokemon.name}" loading="lazy">
        <div class="pokemon-info">
            <h2>${capitalize(pokemon.name)}</h2>
            <div class="pokemon-id">#${String(pokemon.id).padStart(3, '0')}</div>
            <div class="pokemon-types">
                ${pokemon.types.map(t => createTypeBadge(t.type.name)).join('')}
            </div>
            <div class="pokemon-stats">
                ${stats.map((value, i) => createStatElement(value, ["HP", "ATK", "DEF"][i])).join('')}
            </div>
            <div class="pokemon-weaknesses">
                <h4>Weaknesses</h4>
                ${weaknesses.length ? 
                    weaknesses.map(w => createTypeBadge(w)).join('') : 
                    'None'}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => showPokemonDetails(pokemon, weaknesses));
    return card;
}

// Show detailed Pokémon modal
function showPokemonDetails(pokemon, weaknesses) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const stats = pokemon.stats.map(stat => ({
        name: capitalize(stat.stat.name.replace('-', ' ')),
        value: stat.base_stat,
        percentage: Math.min(100, (stat.base_stat / 255) * 100)
    }));
    
    modal.innerHTML = `
        <div class="modal-content">
            <button class="close-modal">✕</button>
            <div class="modal-body">
                <img src="${pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default}" 
                     alt="${pokemon.name}">
                <h2>${capitalize(pokemon.name)}</h2>
                <div class="pokemon-id">#${String(pokemon.id).padStart(3, '0')}</div>
                <div class="pokemon-types">
                    ${pokemon.types.map(t => createTypeBadge(t.type.name)).join('')}
                </div>
                
                <h3>Stats</h3>
                <div class="stats-grid">
                    ${stats.map(stat => createStatBar(stat)).join('')}
                </div>
                
                <h3>Abilities</h3>
                <p>${formatAbilities(pokemon.abilities)}</p>
                
                <h3>Height & Weight</h3>
                <p>${formatHeightWeight(pokemon.height, pokemon.weight)}</p>
                
                <h3>Weaknesses</h3>
                ${weaknesses.length ? 
                    weaknesses.map(w => createTypeBadge(w)).join('') : 
                    'None'}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Close modal handlers
    modal.querySelector('.close-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => e.target === modal && closeModal());
    
    function closeModal() {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// Helper functions
function showLoading(message) {
    pokemonGrid.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

function showError(message) {
    pokemonGrid.innerHTML = `<div class="error-message">${message}</div>`;
}

function clearGrid() {
    pokemonGrid.innerHTML = '';
}

function animateInputError() {
    searchInput.classList.add('shake');
    setTimeout(() => searchInput.classList.remove('shake'), 500);
}

function capitalize(str) {
    return str.split(/[- ]/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function getRandomPokemonIds(count) {
    const ids = new Set();
    while (ids.size < count) {
        ids.add(Math.floor(Math.random() * 151) + 1); // First generation only
    }
    return Array.from(ids);
}

// Component creation helpers
function createTypeBadge(type) {
    return `<span class="type-badge" style="background-color: ${typeColors[type] || '#777'}">
        ${capitalize(type)}
    </span>`;
}

function createStatElement(value, label) {
    return `
        <div class="stat">
            <div class="stat-value">${value}</div>
            <div class="stat-label">${label}</div>
        </div>
    `;
}

function createStatBar(stat) {
    return `
        <div>
            <p>${stat.name}: ${stat.value}</p>
            <div class="stat-bar">
                <div class="stat-fill" style="width: ${stat.percentage}%"></div>
            </div>
        </div>
    `;
}

function formatAbilities(abilities) {
    return abilities.map(a => capitalize(a.ability.name.replace('-', ' '))).join(', ');
}

function formatHeightWeight(height, weight) {
    return `${(height / 10).toFixed(1)} m / ${(weight / 10).toFixed(1)} kg`;
}

// Initialize the app
initApp();