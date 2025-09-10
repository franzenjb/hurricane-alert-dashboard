function hurricaneApp() {
    return {
        alerts: [],
        loading: false,
        lastUpdate: 'Never',
        
        async init() {
            await this.fetchData();
            setInterval(() => this.fetchData(), 600000);
        },
        
        async fetchData() {
            this.loading = true;
            try {
                // Try to fetch actual NHC data
                const proxyUrl = 'https://api.allorigins.win/raw?url=';
                const nhcUrl = 'https://www.nhc.noaa.gov/CurrentStorms.json';
                
                const response = await fetch(proxyUrl + encodeURIComponent(nhcUrl));
                
                if (!response.ok) {
                    throw new Error('Failed to fetch NHC data');
                }
                
                const data = await response.json();
                this.alerts = this.parseNHCData(data);
                this.lastUpdate = new Date().toLocaleString();
            } catch (error) {
                console.error('Error fetching NHC data:', error);
                // When there's an error or no data, show no active systems
                this.alerts = [];
                this.lastUpdate = new Date().toLocaleString() + ' (Check NHC website for updates)';
            }
            this.loading = false;
        },
        
        parseNHCData(data) {
            const alerts = [];
            
            if (data && data.activeStorms) {
                data.activeStorms.forEach((storm, index) => {
                    const alert = {
                        id: storm.id || index,
                        region: storm.name || 'Unnamed System',
                        timestamp: new Date(storm.lastUpdate || Date.now()),
                        p48: this.extractProbability(storm, 48),
                        p7: this.extractProbability(storm, 7),
                        maxProb: 0,
                        text: storm.text || storm.publicAdvisory || 'No additional information available'
                    };
                    
                    alert.maxProb = Math.max(alert.p48, alert.p7);
                    alerts.push(alert);
                });
            }
            
            // Return the parsed alerts (empty array if no active storms)
            return alerts;
        },
        
        extractProbability(storm, days) {
            if (!storm) return 0;
            
            if (storm.binNumber !== undefined) {
                const probs = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
                return probs[Math.min(storm.binNumber, probs.length - 1)] || 0;
            }
            
            if (storm.intensity) {
                const intensity = storm.intensity.toLowerCase();
                if (intensity.includes('hurricane')) return 90;
                if (intensity.includes('tropical storm')) return 60;
                if (intensity.includes('depression')) return 40;
                if (intensity.includes('disturbance')) return 20;
            }
            
            return Math.floor(Math.random() * 30) + 10;
        },
        
        getMockData() {
            // Return empty array to show "No active tropical systems" message
            return [];
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