let prizes = [];
let currentRotation = 0;
let isSpinning = false;

const canvas = document.getElementById('wheel-canvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('btn-spin');
const winnerModal = document.getElementById('winner-modal');
const winnerText = document.getElementById('winner-prize-text');
const resetBtn = document.getElementById('btn-reset');

// Config elements
const configModal = document.getElementById('config-modal');
const editBtn = document.getElementById('btn-edit-config');
const cancelConfigBtn = document.getElementById('btn-config-cancel');
const saveConfigBtn = document.getElementById('btn-config-save');
const addPrizeBtn = document.getElementById('btn-add-prize');
const prizeList = document.getElementById('prize-list');

// Constants
const SPIN_DURATION = 5000; // ms
const SPINS = 8; // Number of full rotations before stopping

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const configParam = urlParams.get('config');
    
    if (configParam) {
        try {
            // Decode the base64 URL parameter (safely handling Unicode/emojis)
            prizes = JSON.parse(decodeURIComponent(atob(configParam)));
        } catch (e) {
            console.error("Could not load config from URL", e);
        }
    }
    
    if (prizes.length === 0) {
        const savedPrizes = localStorage.getItem('prizeWheelConfig');
        if (savedPrizes) {
            prizes = JSON.parse(savedPrizes);
        } else {
            // Fallback bogus data to avoid local CORS issues
            prizes = [
                { id: 1, name: "Mechanical Keyboard", probability: 1, color: "#132646", textColor: "#E8EDF3" },
                { id: 2, name: "T-Shirt", probability: 10, color: "#1c4d8b", textColor: "#E8EDF3" },
                { id: 3, name: "Keycap", probability: 20, color: "#008dff", textColor: "#ffffff" },
                { id: 4, name: "Sticker", probability: 50, color: "#7794B9", textColor: "#132646" },
                { id: 5, name: "Lanyard", probability: 30, color: "#A4B8D1", textColor: "#132646" }
            ];
        }
    }
    
    drawWheel();
}

function getTotalWeight() {
    return prizes.reduce((sum, prize) => sum + parseFloat(prize.probability), 0);
}

function drawWheel() {
    const totalWeight = getTotalWeight();
    let startAngle = 0;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = centerX;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    prizes.forEach((prize) => {
        const angle = (parseFloat(prize.probability) / totalWeight) * 2 * Math.PI;
        
        // Draw wedge
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
        ctx.fillStyle = prize.color;
        ctx.fill();
        
        // Draw border
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.stroke();
        
        // Draw text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + angle / 2);
        
        ctx.textAlign = 'right';
        ctx.fillStyle = prize.textColor || '#ffffff';
        ctx.font = 'bold 20px Outfit, sans-serif';
        // Add shadow for better readability
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        
        // Truncate text if too long
        let text = prize.name;
        if(text.length > 15) text = text.substring(0, 15) + '...';
        
        ctx.fillText(text, radius - 20, 6);
        ctx.restore();
        
        prize.startAngle = startAngle;
        prize.endAngle = startAngle + angle;
        
        startAngle += angle;
    });
    
    // Draw center circle (acts as a backdrop for the HTML button)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 50, 0, 2 * Math.PI);
    ctx.fillStyle = '#132646'; // brand navy
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
}

spinBtn.addEventListener('click', () => {
    if (isSpinning || prizes.length === 0) return;
    isSpinning = true;
    spinBtn.disabled = true;
    
    const totalWeight = getTotalWeight();
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    let winningPrize = null;
    let winningIndex = 0;
    
    for (let i = 0; i < prizes.length; i++) {
        currentWeight += parseFloat(prizes[i].probability);
        if (random <= currentWeight) {
            winningPrize = prizes[i];
            winningIndex = i;
            break;
        }
    }
    
    // Calculate the angle to stop at the center of the winning wedge
    // The pointer is at the top (-90 degrees or -PI/2)
    const winningMiddleAngle = winningPrize.startAngle + (winningPrize.endAngle - winningPrize.startAngle) / 2;
    
    // We want the winning middle angle to land exactly at -PI/2 relative to the canvas container
    // Rotation required to bring this angle to the top
    let targetRotation = (3 * Math.PI / 2) - winningMiddleAngle;
    
    // Add extra spins
    targetRotation += (SPINS * 2 * Math.PI);
    
    // We must accumulate rotation to avoid spinning backwards
    const remainder = currentRotation % (2 * Math.PI);
    const rotationDiff = targetRotation - remainder;
    
    // Ensure we always spin forward at least SPINS times
    let finalRotation = currentRotation + rotationDiff;
    if (rotationDiff < SPINS * 2 * Math.PI) {
        finalRotation += 2 * Math.PI;
    }

    currentRotation = finalRotation;
    
    canvas.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    canvas.style.transform = `rotate(${currentRotation}rad)`;
    
    setTimeout(() => {
        showWinner(winningPrize);
    }, SPIN_DURATION + 200);
});

function showWinner(prize) {
    winnerText.textContent = prize.name;
    winnerModal.classList.remove('hidden');
    
    // Trigger confetti
    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#818cf8', '#c084fc', '#f43f5e', '#fb923c', '#FFD700']
    });
}

resetBtn.addEventListener('click', () => {
    winnerModal.classList.add('hidden');
    isSpinning = false;
    spinBtn.disabled = false;
});

// --- CONFIG EDITOR LOGIC ---

editBtn.addEventListener('click', () => {
    renderConfigList();
    configModal.classList.remove('hidden');
});

cancelConfigBtn.addEventListener('click', () => {
    configModal.classList.add('hidden');
});

// Close modal when clicking outside the content
configModal.addEventListener('click', (e) => {
    if (e.target === configModal) {
        configModal.classList.add('hidden');
    }
});

function renderConfigList() {
    prizeList.innerHTML = '';
    prizes.forEach((prize, index) => {
        const row = document.createElement('div');
        row.className = 'prize-row';
        row.innerHTML = `
            <input type="text" class="cfg-name" value="${prize.name}" placeholder="Prize Name">
            <input type="number" class="cfg-prob" value="${prize.probability}" min="0" step="0.1" placeholder="Weight">
            <input type="color" class="cfg-color" value="${prize.color}" title="Background Color">
            <input type="color" class="cfg-text-color" value="${prize.textColor || '#ffffff'}" title="Text Color">
            <button class="btn-remove" data-index="${index}">🗑️</button>
        `;
        prizeList.appendChild(row);
    });
    
    // Attach remove listeners
    document.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.closest('.btn-remove').getAttribute('data-index');
            prizes.splice(index, 1);
            renderConfigList();
        });
    });
}

addPrizeBtn.addEventListener('click', () => {
    prizes.push({
        name: "New Prize",
        probability: 10,
        color: "#" + Math.floor(Math.random()*16777215).toString(16),
        textColor: "#ffffff"
    });
    renderConfigList();
});

saveConfigBtn.addEventListener('click', () => {
    const rows = document.querySelectorAll('.prize-row');
    const newPrizes = [];
    
    rows.forEach(row => {
        const name = row.querySelector('.cfg-name').value;
        const prob = parseFloat(row.querySelector('.cfg-prob').value) || 0;
        const color = row.querySelector('.cfg-color').value;
        const textColor = row.querySelector('.cfg-text-color').value;
        
        if(name && prob > 0) {
            newPrizes.push({ name, probability: prob, color, textColor });
        }
    });
    
    if(newPrizes.length > 0) {
        prizes = newPrizes;
        localStorage.setItem('prizeWheelConfig', JSON.stringify(prizes));
        
        // Update URL to make it shareable via GitHub Pages!
        try {
            const encodedConfig = btoa(encodeURIComponent(JSON.stringify(prizes)));
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?config=' + encodedConfig;
            window.history.replaceState({path:newUrl}, '', newUrl);
        } catch (e) {
            console.error("Failed to update URL", e);
        }
        
        drawWheel();
        configModal.classList.add('hidden');
    } else {
        alert("You must have at least one prize with a weight > 0!");
    }
});

// Initialize app
init();
