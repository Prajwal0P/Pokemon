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

// Cache Pokémon names and data for autocomplete and reuse
let pokemonNames = [];
const pokemonCache = new Map();

// Cache all type weaknesses after loading once
const typeWeaknessCache = {};

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
    try {
        // Load Pokémon names for autocomplete
        const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=151');
        const data = await response.json();
        pokemonNames = data.results.map(p => p.name);

        // Preload all type weaknesses once and cache
        await loadTypeWeaknesses();

        // Event listeners
        searchInput.addEventListener('input', debounce(handleSearchInput, 300));
        searchInput.addEventListener('focus', showSuggestions);
        searchInput.addEventListener('blur', () => setTimeout(() => suggestionsContainer.style.display = 'none', 200));

        // Initial load fewer Pokémon for faster load
        fetchMultiplePokemon(getRandomPokemonIds(3));
    } catch (error) {
        console.error("Initialization failed:", error);
        showError("Failed to initialize app. Please try again later.");
    }
}

// Load all types weaknesses once
async function loadTypeWeaknesses() {
    const types = Object.keys(typeColors);
    await Promise.all(types.map(async type => {
        const res = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
        const data = await res.json();
        typeWeaknessCache[type] = data.damage_relations.double_damage_from.map(w => w.name);
    }));
}

// Get weaknesses from cached type data
function getWeaknesses(types) {
    const weaknesses = new Set();
    types.forEach(type => {
        (typeWeaknessCache[type] || []).forEach(w => weaknesses.add(w));
    });
    return Array.from(weaknesses);
}

// Main search handler
async function handleSearchInput() {
    const query = searchInput.value.trim().toLowerCase();

    if (query.length > 0) {
        showSuggestions();
    } else {
        suggestionsContainer.style.display = 'none';
        fetchMultiplePokemon(getRandomPokemonIds(3));
        return;
    }

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
        .slice(0, 5);

    if (matchingNames.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }

    suggestionsContainer.innerHTML = matchingNames
        .map(name => `<div class="suggestion">${capitalize(name)}</div>`)
        .join('');

    suggestionsContainer.style.display = 'block';

    suggestionsContainer.querySelectorAll('.suggestion').forEach(suggestion => {
        suggestion.addEventListener('mousedown', (e) => {
            e.preventDefault();
            searchInput.value = suggestion.textContent;
            searchInput.focus();
            handleSearchInput();
        });
    });
}

// Fetch multiple Pokémon data in parallel
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

// Fetch a single Pokémon with caching
async function fetchPokemonData(idOrName) {
    if (pokemonCache.has(idOrName)) return pokemonCache.get(idOrName);

    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${idOrName}`);
    if (!response.ok) throw new Error("Pokémon not found");

    const data = await response.json();
    pokemonCache.set(idOrName, data);
    return data;
}

// Display Pokémon cards in the grid
function displayPokemon(pokemonArray) {
    clearGrid();
    if (!pokemonArray.length) return showError("No Pokémon found.");

    pokemonArray.forEach((pokemon, index) => {
        const weaknesses = getWeaknesses(pokemon.types.map(t => t.type.name));
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
                ${weaknesses.length ? weaknesses.map(w => createTypeBadge(w)).join('') : 'None'}
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
                ${weaknesses.length ? weaknesses.map(w => createTypeBadge(w)).join('') : 'None'}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);

    modal.querySelector('.close-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => e.target === modal && closeModal());

    function closeModal() {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// Helpers for UI parts
function createTypeBadge(type) {
    const color = typeColors[type] || '#777';
    return `<span class="type-badge" style="background-color: ${color};">${capitalize(type)}</span>`;
}

function createStatElement(value, label) {
    const color = value > 80 ? '#4caf50' : value > 50 ? '#ff9800' : '#f44336';
    return `
        <div class="stat">
            <div class="stat-value" style="color:${color}">${value}</div>
            <div class="stat-label">${label}</div>
        </div>
    `;
}

function createStatBar(stat) {
    return `
        <div class="stat-bar">
            <div class="stat-name">${stat.name}</div>
            <div class="bar-container">
                <div class="bar-fill" style="width:${stat.percentage}%; background-color:#4caf50;"></div>
                <span class="stat-value">${stat.value}</span>
            </div>
        </div>
    `;
}

function formatAbilities(abilities) {
    return abilities
        .map(a => capitalize(a.ability.name.replace('-', ' ')) + (a.is_hidden ? ' (Hidden)' : ''))
        .join(', ');
}

function formatHeightWeight(heightDecimeters, weightHectograms) {
    const heightMeters = heightDecimeters / 10;
    const weightKg = weightHectograms / 10;
    return `${heightMeters.toFixed(2)} m, ${weightKg.toFixed(2)} kg`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function clearGrid() {
    pokemonGrid.innerHTML = '';
}

function showLoading(message = "Loading...") {
    clearGrid();
    pokemonGrid.innerHTML = `<div class="loading">${message}</div>`;
}

function showError(message) {
    clearGrid();
    pokemonGrid.innerHTML = `<div class="error">${message}</div>`;
}

function animateInputError() {
    searchInput.classList.add('error');
    setTimeout(() => searchInput.classList.remove('error'), 500);
}

function getRandomPokemonIds(count) {
    const ids = new Set();
    while (ids.size < count) {
        ids.add(Math.floor(Math.random() * 151) + 1);
    }
    return Array.from(ids);
}

// Start the app
initApp();
