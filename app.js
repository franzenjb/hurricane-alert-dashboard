function hurricaneApp() {
    return {
        alerts: [],
        loading: false,
        lastUpdate: 'Never',
        rawTWOText: '',
        
        async init() {
            await this.fetchData();
            // Refresh every 30 minutes (NHC updates at 2/8 AM/PM EDT)
            setInterval(() => this.fetchData(), 1800000);
        },
        
        async fetchData() {
            this.loading = true;
            try {
                // Fetch NHC TWO text (Atlantic)
                const proxyUrl = 'https://api.allorigins.win/raw?url=';
                const twoUrl = 'https://forecast.weather.gov/product.php?issuedby=AT&product=TWO&site=NWS&format=txt&glossary=0';
                
                const response = await fetch(proxyUrl + encodeURIComponent(twoUrl));
                
                if (!response.ok) {
                    throw new Error('Failed to fetch NHC TWO data');
                }
                
                const twoText = await response.text();
                this.rawTWOText = twoText;
                this.alerts = this.parseTWOText(twoText);
                
                // Also try to fetch CurrentStorms.json for active systems
                await this.fetchActiveStorms();
                
                this.lastUpdate = new Date().toLocaleString();
            } catch (error) {
                console.error('Error fetching NHC data:', error);
                this.alerts = [];
                this.lastUpdate = new Date().toLocaleString() + ' (Error fetching data)';
            }
            this.loading = false;
        },
        
        parseTWOText(text) {
            const alerts = [];
            
            // Split text into blocks
            const blocks = text.split(/\n\n+/);
            let regionCounter = 0;
            
            for (const block of blocks) {
                // Look for formation chance patterns
                if (block.includes('Formation chance through')) {
                    const alert = {
                        id: Date.now() + regionCounter++,
                        region: this.extractRegion(block),
                        timestamp: new Date(),
                        p48: 0,
                        p7: 0,
                        maxProb: 0,
                        text: block.trim().substring(0, 800)
                    };
                    
                    // Extract 48-hour probability
                    const match48 = block.match(/through 48 hours[.\s]+(\w+)[.\s]+(\d+)\s*percent/i);
                    if (match48) {
                        alert.p48 = parseInt(match48[2]) || 0;
                    }
                    
                    // Extract 7-day probability
                    const match7 = block.match(/through 7 days[.\s]+(\w+)[.\s]+(\d+)\s*percent/i);
                    if (match7) {
                        alert.p7 = parseInt(match7[2]) || 0;
                    }
                    
                    alert.maxProb = Math.max(alert.p48, alert.p7);
                    
                    // Only add if there's some probability of formation
                    if (alert.maxProb > 0) {
                        alerts.push(alert);
                    }
                }
            }
            
            return alerts;
        },
        
        extractRegion(text) {
            // Try to identify region from text
            const regions = {
                'gulf of mexico': 'Gulf of Mexico',
                'caribbean': 'Caribbean Sea',
                'eastern caribbean': 'Eastern Caribbean',
                'western caribbean': 'Western Caribbean',
                'central atlantic': 'Central Atlantic',
                'eastern atlantic': 'Eastern Atlantic',
                'western atlantic': 'Western Atlantic',
                'bahamas': 'Bahamas',
                'lesser antilles': 'Lesser Antilles',
                'greater antilles': 'Greater Antilles',
                'azores': 'Azores Area',
                'bermuda': 'Bermuda Area'
            };
            
            const lowerText = text.toLowerCase();
            for (const [key, value] of Object.entries(regions)) {
                if (lowerText.includes(key)) {
                    return value;
                }
            }
            
            // Try to extract numbered disturbance
            const disturbanceMatch = text.match(/^\d+\./);
            if (disturbanceMatch) {
                return `Disturbance ${disturbanceMatch[0].replace('.', '')}`;
            }
            
            return 'Atlantic Basin';
        },
        
        async fetchActiveStorms() {
            try {
                const proxyUrl = 'https://api.allorigins.win/raw?url=';
                const stormsUrl = 'https://www.nhc.noaa.gov/CurrentStorms.json';
                
                const response = await fetch(proxyUrl + encodeURIComponent(stormsUrl));
                const data = await response.json();
                
                if (data && data.activeStorms && data.activeStorms.length > 0) {
                    // Add active storms to alerts with higher priority
                    data.activeStorms.forEach(storm => {
                        const alert = {
                            id: storm.id || Date.now(),
                            region: storm.name || 'Active System',
                            timestamp: new Date(storm.lastUpdate || Date.now()),
                            p48: 100, // Active system = 100% chance
                            p7: 100,
                            maxProb: 100,
                            text: `ACTIVE STORM: ${storm.name || 'Unnamed'} - ${storm.headline || storm.text || 'Active tropical system being monitored by NHC'}`,
                            isActive: true
                        };
                        
                        // Add to beginning of alerts array (higher priority)
                        this.alerts.unshift(alert);
                    });
                }
            } catch (error) {
                console.error('Error fetching active storms:', error);
                // Continue without active storms data
            }
        },
        
        formatDate(date) {
            return new Date(date).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
}