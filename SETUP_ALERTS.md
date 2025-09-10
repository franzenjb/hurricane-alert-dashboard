# 🌀 Hurricane Alert Setup Guide

## How It Works (You Don't Need to Do Anything!)

Your hurricane tracker is **already running automatically** on GitHub! Here's what's happening:

1. **GitHub Actions runs your Python tracker every 30 minutes** during hurricane season
2. **When storms threaten Florida, you get automatic alerts**
3. **The dashboard updates itself** at https://franzenjb.github.io/hurricane-alert-dashboard/
4. **Everything is FREE** - no servers needed!

## Setting Up Text Message Alerts (5 minutes)

### Option 1: IFTTT (Easiest - FREE)

1. **Go to [IFTTT.com](https://ifttt.com)** and create a free account
2. **Create an applet:**
   - Click "Create" 
   - For "If This": Choose "Webhooks" → "Receive a web request"
   - Event name: `hurricane_alert`
   - For "Then That": Choose "SMS" or "Notifications" app
   - Set message to: `🌀 {{Value1}} Alert: {{Value2}} - Check: {{Value3}}`
3. **Get your key:**
   - Go to https://ifttt.com/maker_webhooks
   - Click "Documentation"
   - Copy your key (looks like: `dN7xxxxxxxxxxxxxx`)
4. **Add to GitHub:**
   - Go to your repo: https://github.com/franzenjb/hurricane-alert-dashboard
   - Click Settings → Secrets → Actions
   - Click "New repository secret"
   - Name: `IFTTT_KEY`
   - Value: [paste your key]

### Option 2: Email Alerts

1. **Get an App Password** (if using Gmail):
   - Go to https://myaccount.google.com/security
   - Turn on 2-factor authentication
   - Generate an "App Password" for Mail
2. **Add to GitHub Secrets:**
   - `EMAIL_USERNAME`: your email
   - `EMAIL_PASSWORD`: the app password
   - `ALERT_EMAIL`: where to send alerts

### Option 3: Slack Alerts

1. **Create Slack Webhook:**
   - Go to your Slack workspace
   - Add "Incoming Webhooks" app
   - Create webhook for your channel
2. **Add to GitHub:**
   - Secret name: `SLACK_WEBHOOK`
   - Value: your webhook URL

## Testing Your Alerts

1. **Go to:** https://github.com/franzenjb/hurricane-alert-dashboard/actions
2. **Click:** "Hurricane Text Alerts"
3. **Click:** "Run workflow" → "Run workflow"
4. **Wait 30 seconds** - you should get a test alert!

## What You'll Get

### 🟢 GREEN Alert (No action needed)
- No threats to Florida
- Dashboard shows all clear

### 🟡 YELLOW Alert (Watch)
- System developing that could affect Florida
- Check dashboard for details

### 🟠 ORANGE Alert (Warning)
- High probability (60%+) of development near Florida
- Start preparations

### 🔴 RED Alert (CRITICAL)
- Active storm threatening Florida
- Take immediate action per local authorities

## Alert Schedule

- **Hurricane Season (June-Nov):** Checks every 30 minutes
- **Off Season:** Checks every 2 hours
- **Major Changes Only:** Won't spam you with repeat alerts

## Dashboard

Your live dashboard auto-updates at:
https://franzenjb.github.io/hurricane-alert-dashboard/

## How to Stop Alerts

1. Go to: https://github.com/franzenjb/hurricane-alert-dashboard/actions
2. Click each workflow
3. Click "..." → "Disable workflow"

## That's It!

You now have a professional hurricane tracking system that:
- ✅ Runs automatically forever (free)
- ✅ Texts you when storms threaten Florida
- ✅ Updates a live dashboard
- ✅ Uses official NHC data
- ✅ No maintenance required

## Troubleshooting

**Not getting alerts?**
- Check https://github.com/franzenjb/hurricane-alert-dashboard/actions for errors
- Verify your IFTTT key or email settings
- Make sure workflows are enabled

**Too many alerts?**
- The system only alerts on changes
- Adjust the schedule in the workflow files

**Dashboard not updating?**
- Check if GitHub Pages is enabled in Settings
- Wait 2-3 minutes after updates