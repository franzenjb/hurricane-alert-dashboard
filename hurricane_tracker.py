#!/usr/bin/env python3
"""
Hurricane Alert System - Professional Grade
Monitors NHC TWO, GIS polygons, and CurrentStorms for Florida AOI
"""

import requests
import re
import json
from datetime import datetime, timezone, timedelta
import time
import os
from typing import Dict, List, Optional, Tuple
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class HurricaneTracker:
    def __init__(self):
        self.two_url = "https://forecast.weather.gov/product.php?issuedby=AT&product=TWO&site=NWS&format=txt&glossary=0"
        self.gis_rss = "https://www.nhc.noaa.gov/gis/rss.php?basin=al"
        self.current_storms = "https://www.nhc.noaa.gov/CurrentStorms.json"
        
        # Florida AOI (Area of Interest) - expanded box around Florida
        self.florida_bbox = {
            'west': -87.8,
            'east': -79.6, 
            'south': 24.0,
            'north': 31.1
        }
        
        # Cache for tracking changes
        self.last_alerts = []
        self.alerts = []
        
    def fetch_two_text(self) -> str:
        """Fetch NHC Tropical Weather Outlook text"""
        try:
            response = requests.get(self.two_url, timeout=20)
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.error(f"Failed to fetch TWO text: {e}")
            return ""
    
    def parse_two_text(self, text: str) -> List[Dict]:
        """Parse TWO text for formation probabilities"""
        entries = []
        blocks = re.split(r"\n\n+", text)
        
        for i, block in enumerate(blocks):
            if "Formation chance through" in block:
                # Extract probabilities
                m48 = re.search(r"through 48 hours[.\s]+(\w+)[.\s]+(\d+)\s*percent", block, re.I)
                m7 = re.search(r"through 7 days[.\s]+(\w+)[.\s]+(\d+)\s*percent", block, re.I)
                
                p48 = int(m48.group(2)) if m48 else 0
                p7 = int(m7.group(2)) if m7 else 0
                
                # Extract location/region
                region = self.extract_region(block)
                
                # Determine if it threatens Florida
                threatens_fl = self.check_florida_threat(block)
                
                entry = {
                    "id": f"two_{i}",
                    "type": "potential",
                    "region": region,
                    "text": block.strip()[:800],
                    "p48": p48,
                    "p7": p7,
                    "max_prob": max(p48, p7),
                    "threatens_florida": threatens_fl,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
                entries.append(entry)
                logger.info(f"Found disturbance: {region} - 48hr: {p48}%, 7d: {p7}%")
        
        return entries
    
    def extract_region(self, text: str) -> str:
        """Extract region from TWO text"""
        regions = {
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
            'yucatan': 'Yucatan Peninsula',
            'central america': 'Central America'
        }
        
        lower_text = text.lower()
        for key, value in regions.items():
            if key in lower_text:
                return value
        
        # Try to find numbered disturbance
        dist_match = re.search(r"(\d+)\.", text)
        if dist_match:
            return f"Disturbance {dist_match.group(1)}"
        
        return "Atlantic Basin"
    
    def check_florida_threat(self, text: str) -> bool:
        """Check if disturbance threatens Florida based on text analysis"""
        threat_keywords = [
            'florida', 'gulf of mexico', 'bahamas', 'cuba',
            'western atlantic', 'southeastern united states',
            'gulf coast', 'keys', 'miami', 'tampa', 'jacksonville'
        ]
        
        lower_text = text.lower()
        
        # Check for direct mentions
        for keyword in threat_keywords:
            if keyword in lower_text:
                return True
        
        # Check for movement patterns that could affect Florida
        if 'westward' in lower_text or 'west-northwestward' in lower_text:
            if any(region in lower_text for region in ['caribbean', 'atlantic', 'antilles']):
                return True
        
        return False
    
    def fetch_gis_polygons(self) -> Optional[List[Dict]]:
        """Fetch and parse NHC GIS polygons"""
        try:
            # Get RSS feed
            rss_response = requests.get(self.gis_rss, timeout=20)
            rss_response.raise_for_status()
            rss_xml = rss_response.text
            
            # Find latest GTWO shapefile
            gtwo_match = re.search(r'https://[^"\']+gtwo[^"\']+\.kmz', rss_xml, re.I)
            if not gtwo_match:
                gtwo_match = re.search(r'https://[^"\']+gtwo[^"\']+\.zip', rss_xml, re.I)
            
            if gtwo_match:
                logger.info(f"Found GIS file: {gtwo_match.group(0)}")
                # For now, we'll just note that GIS data is available
                # Full implementation would download and parse the shapefile
                return [{"gis_available": True, "url": gtwo_match.group(0)}]
            
        except Exception as e:
            logger.error(f"Failed to fetch GIS polygons: {e}")
        
        return None
    
    def fetch_active_storms(self) -> List[Dict]:
        """Fetch currently active ATLANTIC/GULF storms from NHC"""
        storms = []
        try:
            response = requests.get(self.current_storms, timeout=20)
            response.raise_for_status()
            data = response.json()
            
            if data.get('activeStorms'):
                for storm in data['activeStorms']:
                    # Get storm identifiers
                    storm_id = storm.get('id', '').lower()
                    basin = storm.get('basin', '').lower()
                    bin_number = storm.get('binNumber', '').lower()
                    storm_name = storm.get('name', 'Unknown')
                    
                    # STRICT ATLANTIC-ONLY FILTERING
                    # Pacific storms have IDs starting with 'ep', 'cp', 'wp'
                    # Pacific storms have basins like 'CP', 'EP', 'WP', 'Pacific'  
                    # Pacific storms have binNumbers starting with 'CP', 'EP', 'WP'
                    
                    is_pacific = (
                        storm_id.startswith('ep') or 
                        storm_id.startswith('cp') or 
                        storm_id.startswith('wp') or
                        'pacific' in basin or
                        'ep' in basin or 
                        'cp' in basin or 
                        'wp' in basin or
                        bin_number.startswith('cp') or
                        bin_number.startswith('ep') or
                        bin_number.startswith('wp')
                    )
                    
                    if is_pacific:
                        logger.info(f"SKIPPING Pacific storm: {storm_name} (ID: {storm.get('id')}, Basin: {storm.get('basin')}, Bin: {storm.get('binNumber')})")
                        continue
                    
                    # ONLY ALLOW CONFIRMED ATLANTIC STORMS
                    # Atlantic storms have IDs starting with 'al'
                    # Atlantic storms have binNumbers starting with 'AL' or 'AT'
                    is_atlantic = (
                        storm_id.startswith('al') or
                        bin_number.startswith('al') or
                        bin_number.startswith('at')
                    )
                    
                    if not is_atlantic:
                        logger.info(f"SKIPPING non-Atlantic storm: {storm_name} (ID: {storm.get('id')}, Basin: {storm.get('basin')}, Bin: {storm.get('binNumber')})")
                        continue
                    
                    # Process confirmed Atlantic storm
                    storm_info = {
                        "id": storm.get('id', 'unknown'),
                        "type": "active",
                        "name": storm.get('name', 'Unnamed'),
                        "classification": storm.get('classification', 'Unknown'),
                        "intensity": storm.get('intensity', 0),
                        "pressure": storm.get('pressure', 0),
                        "lat": storm.get('lat', 0),
                        "lon": storm.get('lon', 0),
                        "movement": storm.get('movementDir', 'Unknown'),
                        "speed": storm.get('movementSpeed', 0),
                        "threatens_florida": self.check_storm_threatens_florida(storm),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "advisory_url": f"https://www.nhc.noaa.gov/text/refresh/MIATCP{storm.get('binNumber', '')}"
                    }
                    storms.append(storm_info)
                    logger.info(f"ACCEPTED Atlantic storm: {storm_info['name']} - {storm_info['classification']} (ID: {storm.get('id')})")
            
        except Exception as e:
            logger.error(f"Failed to fetch active storms: {e}")
        
        return storms
    
    def check_storm_threatens_florida(self, storm: Dict) -> bool:
        """Check if an active storm threatens Florida"""
        if not storm.get('lat') or not storm.get('lon'):
            return False
        
        lat, lon = storm['lat'], storm['lon']
        
        # Check if within expanded threat zone
        threat_zone = {
            'west': self.florida_bbox['west'] - 10,  # ~1000km buffer
            'east': self.florida_bbox['east'] + 5,
            'south': self.florida_bbox['south'] - 5,
            'north': self.florida_bbox['north'] + 5
        }
        
        in_zone = (threat_zone['west'] <= lon <= threat_zone['east'] and
                   threat_zone['south'] <= lat <= threat_zone['north'])
        
        # Check movement direction
        movement = storm.get('movementDir', '').lower()
        threatening_movements = ['w', 'wnw', 'nw', 'n', 'nnw']
        
        return in_zone or any(move in movement for move in threatening_movements)
    
    def generate_alert_summary(self) -> Dict:
        """Generate comprehensive alert summary"""
        summary = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "alert_level": "green",  # green, yellow, orange, red
            "total_systems": len(self.alerts),
            "florida_threats": 0,
            "active_storms": [],
            "potential_systems": [],
            "message": ""
        }
        
        for alert in self.alerts:
            if alert.get('threatens_florida'):
                summary['florida_threats'] += 1
            
            if alert['type'] == 'active':
                summary['active_storms'].append(alert)
            else:
                summary['potential_systems'].append(alert)
        
        # Determine alert level
        if summary['active_storms'] and any(s['threatens_florida'] for s in summary['active_storms']):
            summary['alert_level'] = "red"
            summary['message'] = "ACTIVE STORM THREATENING FLORIDA"
        elif summary['florida_threats'] > 0:
            max_prob = max([a['max_prob'] for a in self.alerts if a.get('threatens_florida')], default=0)
            if max_prob >= 60:
                summary['alert_level'] = "orange"
                summary['message'] = "HIGH probability of development near Florida"
            elif max_prob >= 30:
                summary['alert_level'] = "yellow"
                summary['message'] = "MODERATE probability of development near Florida"
            else:
                summary['alert_level'] = "yellow"
                summary['message'] = "LOW probability system being monitored"
        elif summary['total_systems'] > 0:
            summary['alert_level'] = "green"
            summary['message'] = "Systems present but not threatening Florida"
        else:
            summary['alert_level'] = "green"
            summary['message'] = "No tropical activity"
        
        return summary
    
    def run_check(self) -> Dict:
        """Run complete hurricane check"""
        logger.info("=" * 50)
        logger.info("Running Hurricane Alert Check")
        logger.info("=" * 50)
        
        # Fetch all data
        two_text = self.fetch_two_text()
        two_alerts = self.parse_two_text(two_text) if two_text else []
        
        gis_data = self.fetch_gis_polygons()
        active_storms = self.fetch_active_storms()
        
        # Combine all alerts
        self.alerts = active_storms + two_alerts
        
        # Generate summary
        summary = self.generate_alert_summary()
        
        # Log results
        logger.info(f"Alert Level: {summary['alert_level'].upper()}")
        logger.info(f"Total Systems: {summary['total_systems']}")
        logger.info(f"Florida Threats: {summary['florida_threats']}")
        logger.info(f"Message: {summary['message']}")
        
        # Save to JSON file for web dashboard
        self.save_to_json(summary)
        
        return summary
    
    def save_to_json(self, summary: Dict):
        """Save alert data to JSON for web dashboard"""
        output = {
            "summary": summary,
            "alerts": self.alerts,
            "last_check": datetime.now(timezone.utc).isoformat()
        }
        
        with open('hurricane_data.json', 'w') as f:
            json.dump(output, f, indent=2)
        
        logger.info("Saved data to hurricane_data.json")
    
    def run_continuous(self, interval_minutes: int = 30):
        """Run continuous monitoring"""
        logger.info(f"Starting continuous monitoring (checking every {interval_minutes} minutes)")
        
        while True:
            try:
                summary = self.run_check()
                
                # Send notifications if needed
                if summary['alert_level'] in ['orange', 'red']:
                    self.send_notification(summary)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
            
            # Wait for next check
            logger.info(f"Next check in {interval_minutes} minutes...")
            time.sleep(interval_minutes * 60)
    
    def send_notification(self, summary: Dict):
        """Send notification (placeholder for email/SMS/Slack)"""
        logger.warning("=" * 50)
        logger.warning(f"ALERT: {summary['message']}")
        logger.warning(f"Level: {summary['alert_level'].upper()}")
        logger.warning(f"Florida Threats: {summary['florida_threats']}")
        logger.warning("=" * 50)
        
        # TODO: Implement actual notifications
        # - Email via SMTP
        # - SMS via Twilio
        # - Slack webhook
        # - Push to database

if __name__ == "__main__":
    tracker = HurricaneTracker()
    
    # Run single check
    summary = tracker.run_check()
    
    # Uncomment for continuous monitoring
    # tracker.run_continuous(interval_minutes=30)