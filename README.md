# Polarity Phantom Integration

![image](https://img.shields.io/badge/status-beta-green.svg)

Polarity's Phantom integration allows automated queries against Phantom's container and artifact database, create containers from entities, and allows a user to execute pre-defined playbooks from the Polarity overlay window.

## Normal Event with Playbook History
<div style="display:flex; justify-content:center; align-items:center;">
  <img width="400" alt="Integration Example Event Info" src="./assets/integration-example-event-info.png">
  <img width="400" alt="Integration Example Event History" src="./assets/integration-example-event-history.png">
</div>

## Create New Event
<div style="display:flex; justify-content:center; align-items:center;">
  <img width="400" alt="Integration Example New Event" src="./assets/integration-example-new-event.png">
  <img width="400" alt="Integration Example New Event Created" src="./assets/integration-example-new-event-created.png">
</div>

To learn more about Phantom, visit the [official website](https://www.phantom.us).


## Phantom Integration Options

### Server URL

The Server URL where the Phantom API instance is located.  The Server URL should include the schema (https://), and the fully qualified domain name or IP address of the Phantom server. For example, `https://myphantom.server`.

### Token

The API token used to authenticate with the Phantom server.  See the official Phantom documentation for instructions on setting up an API token.

### Playbook Labels

A comma separated list of Playbook Labels used to determine which playbooks can be run on Indicators in Phantom. By adding labels, you make more Playbooks available for you to run. The default value is "events".

### Only Show Events with Playbook Labels

If checked, only Events that have one of your Playbook Labels listed will show up in the overlay.


## Installation Instructions

Installation instructions for integrations are provided on the [PolarityIO GitHub Page](https://polarityio.github.io/).


## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making.  For more information about the Polarity platform please see:

https://polarity.io/
