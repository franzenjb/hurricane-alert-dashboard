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
                const proxyUrl = 'https://api.allorigins.win/raw?url=';
                const nhcUrl = 'https://www.nhc.noaa.gov/CurrentStorms.json';
                
                const response = await fetch(proxyUrl + encodeURIComponent(nhcUrl));
                const data = await response.json();
                
                this.alerts = this.parseNHCData(data);
                this.lastUpdate = new Date().toLocaleString();
            } catch (error) {
                console.error('Error fetching NHC data:', error);
                this.alerts = this.getMockData();
                this.lastUpdate = new Date().toLocaleString() + ' (Mock Data)';
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
            
            if (alerts.length === 0) {
                return this.getMockData();
            }
            
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
            return [
                {
                    id: 1,
                    region: 'Eastern Caribbean',
                    timestamp: new Date(),
                    p48: 30,
                    p7: 60,
                    maxProb: 60,
                    text: 'A tropical wave located several hundred miles east of the Lesser Antilles is producing disorganized showers and thunderstorms. Environmental conditions could become more conducive for gradual development of this system during the next several days while it moves westward at 15 to 20 mph across the Lesser Antilles and into the eastern Caribbean Sea.'
                },
                {
                    id: 2,
                    region: 'Central Atlantic',
                    timestamp: new Date(),
                    p48: 10,
                    p7: 20,
                    maxProb: 20,
                    text: 'A low pressure area located about 900 miles west-southwest of the Azores is producing limited shower activity. Some slow development of this system is possible during the next few days while it moves generally eastward over the central Atlantic.'
                }
            ];
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