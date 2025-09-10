function hurricaneApp() {
    return {
        // State
        alertLevel: 'green',
        alertMessage: '',
        totalSystems: 0,
        floridaThreats: 0,
        activeStorms: [],
        potentialSystems: [],
        lastUpdate: 'Never',
        gisAvailable: false,
        alertHistory: [],
        
        // Map
        map: null,
        floridaAOI: null,
        stormMarkers: [],
        showFloridaAOI: true,
        
        // Chart
        probChart: null,
        
        async init() {
            this.initMap();
            this.initChart();
            await this.fetchData();
            
            // Auto-refresh every 30 minutes
            setInterval(() => this.fetchData(), 1800000);
            
            // Load alert history from localStorage
            this.loadAlertHistory();
        },
        
        initMap() {
            // Initialize Leaflet map
            this.map = L.map('map').setView([25, -75], 4);
            
            // Add tile layer
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap contributors © CARTO',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(this.map);
            
            // Add Florida AOI
            const floridaBounds = [
                [24.0, -87.8],
                [24.0, -79.6],
                [31.1, -79.6],
                [31.1, -87.8],
                [24.0, -87.8]
            ];
            
            this.floridaAOI = L.polygon(floridaBounds, {
                color: 'blue',
                fillColor: 'blue',
                fillOpacity: 0.1,
                weight: 2
            }).addTo(this.map);
            
            // Add threat zone (expanded Florida AOI)
            const threatBounds = [
                [19.0, -97.8],
                [19.0, -74.6],
                [36.1, -74.6],
                [36.1, -97.8],
                [19.0, -97.8]
            ];
            
            L.polygon(threatBounds, {
                color: 'orange',
                fillColor: 'orange',
                fillOpacity: 0.05,
                weight: 1,
                dashArray: '5, 10'
            }).addTo(this.map);
        },
        
        initChart() {
            const ctx = document.getElementById('probChart').getContext('2d');
            this.probChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: '48-Hour Probability',
                        data: [],
                        backgroundColor: 'rgba(255, 159, 64, 0.8)',
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1
                    }, {
                        label: '7-Day Probability',
                        data: [],
                        backgroundColor: 'rgba(255, 99, 132, 0.8)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                },
                                color: '#9CA3AF'
                            },
                            grid: {
                                color: 'rgba(156, 163, 175, 0.2)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#9CA3AF'
                            },
                            grid: {
                                color: 'rgba(156, 163, 175, 0.2)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#9CA3AF'
                            }
                        }
                    }
                }
            });
        },
        
        async fetchData() {
            try {
                // First try to fetch from Python backend if available
                try {
                    const response = await fetch('hurricane_data.json');
                    if (response.ok) {
                        const data = await response.json();
                        this.processBackendData(data);
                        return;
                    }
                } catch (e) {
                    console.log('Backend data not available, fetching directly...');
                }
                
                // Fallback to direct fetching
                await this.fetchDirectData();
                
            } catch (error) {
                console.error('Error fetching data:', error);
                this.alertLevel = 'yellow';
                this.alertMessage = 'Data fetch error - check console';
            }
        },
        
        processBackendData(data) {
            const summary = data.summary;
            const alerts = data.alerts || [];
            
            this.alertLevel = summary.alert_level;
            this.alertMessage = summary.message;
            this.totalSystems = summary.total_systems;
            this.floridaThreats = summary.florida_threats;
            
            // Separate active and potential systems
            this.activeStorms = alerts.filter(a => a.type === 'active');
            this.potentialSystems = alerts.filter(a => a.type === 'potential');
            
            this.lastUpdate = new Date(data.last_check).toLocaleString();
            
            // Update map
            this.updateMap();
            
            // Update chart
            this.updateChart();
            
            // Add to alert history if level changed
            this.updateAlertHistory(summary);
        },
        
        async fetchDirectData() {
            // Fetch TWO text
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const twoUrl = 'https://forecast.weather.gov/product.php?issuedby=AT&product=TWO&site=NWS&format=txt&glossary=0';
            
            const twoResponse = await fetch(proxyUrl + encodeURIComponent(twoUrl));
            const twoText = await twoResponse.text();
            
            // Parse TWO
            const systems = this.parseTWO(twoText);
            
            // Fetch CurrentStorms
            try {
                const stormsResponse = await fetch(proxyUrl + 'https://www.nhc.noaa.gov/CurrentStorms.json');
                const stormsData = await stormsResponse.json();
                
                if (stormsData.activeStorms) {
                    stormsData.activeStorms.forEach(storm => {
                        // SKIP PACIFIC STORMS - ONLY ATLANTIC/GULF
                        const basin = (storm.basin || '').toLowerCase();
                        if (basin.includes('pacific') || basin === 'ep' || basin === 'cp') {
                            console.log('Skipping Pacific storm:', storm.name);
                            return;
                        }
                        
                        systems.unshift({
                            id: storm.id,
                            type: 'active',
                            name: storm.name,
                            classification: storm.classification || 'Tropical System',
                            intensity: storm.intensity || 0,
                            lat: storm.lat,
                            lon: storm.lon,
                            movement: storm.movementDir || 'Stationary',
                            speed: storm.movementSpeed || 0,
                            threatens_florida: this.checkFloridaThreat(storm),
                            p48: 100,
                            p7: 100,
                            max_prob: 100
                        });
                    });
                }
            } catch (e) {
                console.error('Error fetching active storms:', e);
            }
            
            // Process systems
            this.activeStorms = systems.filter(s => s.type === 'active');
            this.potentialSystems = systems.filter(s => s.type === 'potential');
            this.totalSystems = systems.length;
            this.floridaThreats = systems.filter(s => s.threatens_florida).length;
            
            // Determine alert level
            this.determineAlertLevel();
            
            this.lastUpdate = new Date().toLocaleString();
            
            // Update visualizations
            this.updateMap();
            this.updateChart();
        },
        
        parseTWO(text) {
            const systems = [];
            const blocks = text.split(/\n\n+/);
            
            blocks.forEach((block, i) => {
                if (block.includes('Formation chance through')) {
                    const m48 = block.match(/through 48 hours[.\s]+(\w+)[.\s]+(\d+)\s*percent/i);
                    const m7 = block.match(/through 7 days[.\s]+(\w+)[.\s]+(\d+)\s*percent/i);
                    
                    const p48 = m48 ? parseInt(m48[2]) : 0;
                    const p7 = m7 ? parseInt(m7[2]) : 0;
                    
                    if (p48 > 0 || p7 > 0) {
                        systems.push({
                            id: `two_${i}`,
                            type: 'potential',
                            region: this.extractRegion(block),
                            text: block.substring(0, 500),
                            p48: p48,
                            p7: p7,
                            max_prob: Math.max(p48, p7),
                            threatens_florida: this.checkTextForFloridaThreat(block)
                        });
                    }
                }
            });
            
            return systems;
        },
        
        extractRegion(text) {
            const regions = {
                'gulf of mexico': 'Gulf of Mexico',
                'caribbean': 'Caribbean',
                'eastern caribbean': 'E. Caribbean',
                'western caribbean': 'W. Caribbean',
                'atlantic': 'Atlantic',
                'bahamas': 'Bahamas',
                'lesser antilles': 'Lesser Antilles'
            };
            
            const lower = text.toLowerCase();
            for (const [key, value] of Object.entries(regions)) {
                if (lower.includes(key)) return value;
            }
            return 'Atlantic Basin';
        },
        
        checkTextForFloridaThreat(text) {
            const threats = ['florida', 'gulf of mexico', 'bahamas', 'keys', 'southeastern united states'];
            const lower = text.toLowerCase();
            return threats.some(t => lower.includes(t));
        },
        
        checkFloridaThreat(storm) {
            if (!storm.lat || !storm.lon) return false;
            
            // Check if in threat zone
            const inZone = storm.lon >= -97.8 && storm.lon <= -74.6 &&
                          storm.lat >= 19.0 && storm.lat <= 36.1;
            
            // Check movement
            const threateningMovements = ['w', 'wnw', 'nw', 'n', 'nnw'];
            const movement = (storm.movementDir || '').toLowerCase();
            
            return inZone || threateningMovements.some(m => movement.includes(m));
        },
        
        determineAlertLevel() {
            const flThreats = this.activeStorms.filter(s => s.threatens_florida);
            
            if (flThreats.length > 0) {
                this.alertLevel = 'red';
                this.alertMessage = `ACTIVE STORM THREATENING FLORIDA: ${flThreats[0].name || 'System'}`;
            } else if (this.floridaThreats > 0) {
                const maxProb = Math.max(...this.potentialSystems.filter(s => s.threatens_florida).map(s => s.max_prob));
                if (maxProb >= 60) {
                    this.alertLevel = 'orange';
                    this.alertMessage = 'HIGH probability of development near Florida';
                } else if (maxProb >= 30) {
                    this.alertLevel = 'yellow';
                    this.alertMessage = 'MODERATE probability of development near Florida';
                } else {
                    this.alertLevel = 'yellow';
                    this.alertMessage = 'LOW probability system being monitored';
                }
            } else if (this.totalSystems > 0) {
                this.alertLevel = 'green';
                this.alertMessage = 'Systems present but not threatening Florida';
            } else {
                this.alertLevel = 'green';
                this.alertMessage = 'No tropical activity';
            }
        },
        
        updateMap() {
            // Clear existing markers
            this.stormMarkers.forEach(marker => this.map.removeLayer(marker));
            this.stormMarkers = [];
            
            // Add active storm markers
            this.activeStorms.forEach(storm => {
                if (storm.lat && storm.lon) {
                    const icon = L.divIcon({
                        html: `<div class="w-6 h-6 bg-red-500 rounded-full border-2 border-white"></div>`,
                        className: 'custom-div-icon',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });
                    
                    const marker = L.marker([storm.lat, storm.lon], { icon })
                        .bindPopup(`<strong>${storm.name}</strong><br>${storm.classification}<br>Winds: ${storm.intensity} mph`)
                        .addTo(this.map);
                    
                    this.stormMarkers.push(marker);
                }
            });
            
            // Add potential development areas (mock positions for demo)
            this.potentialSystems.forEach((system, i) => {
                // Estimate position based on region
                const positions = {
                    'Gulf of Mexico': [25, -90],
                    'Caribbean': [15, -75],
                    'E. Caribbean': [13, -60],
                    'W. Caribbean': [15, -85],
                    'Atlantic': [20, -50],
                    'Bahamas': [24, -76],
                    'Lesser Antilles': [15, -61]
                };
                
                const pos = positions[system.region] || [20, -60];
                
                const icon = L.divIcon({
                    html: `<div class="w-6 h-6 bg-yellow-500 rounded-full border-2 border-white opacity-75"></div>`,
                    className: 'custom-div-icon',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                
                const marker = L.marker(pos, { icon })
                    .bindPopup(`<strong>${system.region}</strong><br>48hr: ${system.p48}%<br>7-day: ${system.p7}%`)
                    .addTo(this.map);
                
                this.stormMarkers.push(marker);
            });
        },
        
        updateChart() {
            const labels = [];
            const data48 = [];
            const data7 = [];
            
            // Add active storms
            this.activeStorms.forEach(storm => {
                labels.push(storm.name || 'Active');
                data48.push(100);
                data7.push(100);
            });
            
            // Add potential systems
            this.potentialSystems.forEach(system => {
                labels.push(system.region);
                data48.push(system.p48);
                data7.push(system.p7);
            });
            
            // Update chart
            this.probChart.data.labels = labels;
            this.probChart.data.datasets[0].data = data48;
            this.probChart.data.datasets[1].data = data7;
            this.probChart.update();
        },
        
        toggleFloridaAOI() {
            this.showFloridaAOI = !this.showFloridaAOI;
            if (this.showFloridaAOI) {
                this.floridaAOI.addTo(this.map);
            } else {
                this.map.removeLayer(this.floridaAOI);
            }
        },
        
        updateAlertHistory(summary) {
            const entry = {
                time: new Date().toLocaleTimeString(),
                message: `${summary.alert_level.toUpperCase()}: ${summary.message}`
            };
            
            this.alertHistory.unshift(entry);
            this.alertHistory = this.alertHistory.slice(0, 10); // Keep last 10
            
            // Save to localStorage
            localStorage.setItem('alertHistory', JSON.stringify(this.alertHistory));
        },
        
        loadAlertHistory() {
            const saved = localStorage.getItem('alertHistory');
            if (saved) {
                this.alertHistory = JSON.parse(saved);
            }
        }
    }
}