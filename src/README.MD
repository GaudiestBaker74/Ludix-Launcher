<a id="readme-top"></a>

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![Unlicense License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/GaudiestBaker74/Ludix-Launcher">
    <img src="src/build/logo.png" alt="Logo" width="250" height="250">
  </a>

  <h3 align="center"></h3>

  <p align="center">
    A Game Launcher for your games
    <br />
    <a href="https://github.com/GaudiestBaker74/Ludix-Launcher/releases"><strong>Install It »</strong></a>
    <br />
    <br />
    <a href="https://github.com/GaudiestBaker74/Ludix-Launcher">Download</a>
    &middot;
    <a href="https://github.com/GaudiestBaker74/Ludix-Launcher/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/GaudiestBaker74/Ludix-Launcher/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT LUDIX LAUNCHER -->

## About Ludix Launcher

[![Product Name Screen Shot][product-screenshot]](https://raw.githubusercontent.com/GaudiestBaker74/Ludix-Launcher/main/images/screenshot.png)

> Background is custom, you can change it on the console.

Ludix Launcher is a modern, lightweight game launcher designed to centralize your gaming library. It seamlessly integrates with Steam and Epic Games, providing a unified interface to launch your favorite titles while automatically tracking your play time.

Features:

- **Library Centralization**: Automatically detects installed Steam games and allows manual adding of Epic Games.
- **Play Time Tracking**: Keeps track of how many minutes you've spent in each game across all platforms.
- **Tray Integration**: Runs quietly in the background, ensuring play time is recorded even when the main window is closed.
- **Custom Notifications**: Alerts you when a gaming session ends with a summary of your play time.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

Ludix Launcher is built using modern web technologies and the Electron framework to ensure cross-platform compatibility and high performance.

- [![Javascript][Javascript]][Javascript-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

To get a local copy of Ludix Launcher up and running, follow these steps.

### Prerequisites

You need to have Node.js and npm installed on your machine.

- npm
  ```sh
  npm install npm@latest -g
  ```

### Installation

_Below is an example of how you can instruct your audience on installing and setting up your app. This template doesn't rely on any external dependencies or services._

**FOR PERSONAL USAGE**

1. Go to the [Releases](https://github.com/GaudiestBaker74/Ludix-Launcher/releases) Tab

2. Install the Launcher

3. That's It!

**FOR CONTRIBUTION**

1. Clone the repo
   ```sh
   git clone https://github.com/GaudiestBaker74/Ludix-Launcher.git
   ```
2. Install NPM packages
   ```sh
   npm install electron electron-builder
   ```
3. Change git remote url to avoid accidental pushes to base project
   ```sh
   git remote set-url origin GaudiestBaker74/Ludix-Launcher
   git remote -v # confirm the changes
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->

## Usage

Once installed, Ludix Launcher will automatically scan for your Steam games. To add Epic Games, use the "Add Game" feature (+) and select the executable. The launcher will automatically start tracking your play time as soon as you launch a game.

- **Manage Games**: View all your installed games in one place.
- **Tray Icon**: Right-click the tray icon to quickly restore the app or close it completely.
- **Reset Stats**: You can reset all tracking times from the settings if you wish to start over.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->

## Roadmap

- [ ] More Commands
- [ ] Auto-Detect Epic Games
- [ ] Better Performance
- [ ] Auto Launch when the computer starts up
- [ ] Create an option that shows you at the end of the week how many hours you played and what games you played.
- [ ] Multi-language Support
  - [ ] Spanish

See the [open issues](https://github.com/GaudiestBaker74/Ludix-Launcher/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Top contributors:

<a href="https://github.com/GaudiestBaker74/Ludix-Launcher/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=GaudiestBaker74/Ludix-Launcher" alt="contrib.rocks image" />
</a>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under the Unlicense License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Project Link: [https://github.com/GaudiestBaker74/Ludix-Launcher](https://github.com/GaudiestBaker74/Ludix-Launcher)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

Special thanks to the open-source community and the following resources that helped in the development of Ludix Launcher:

- [Electron](https://www.electronjs.org/)
- [Steam ACF Parser Logic](https://github.com/ValvePython/vdf)
- [Best-README-Template](https://github.com/othneildrew/Best-README-Template)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/GaudiestBaker74/Ludix-Launcher.svg?style=for-the-badge
[contributors-url]: https://github.com/GaudiestBaker74/Ludix-Launcher/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/GaudiestBaker74/Ludix-Launcher.svg?style=for-the-badge
[forks-url]: https://github.com/GaudiestBaker74/Ludix-Launcher/network/members
[stars-shield]: https://img.shields.io/github/stars/GaudiestBaker74/Ludix-Launcher.svg?style=for-the-badge
[stars-url]: https://github.com/GaudiestBaker74/Ludix-Launcher/stargazers
[issues-shield]: https://img.shields.io/github/issues/GaudiestBaker74/Ludix-Launcher.svg?style=for-the-badge
[issues-url]: https://github.com/GaudiestBaker74/Ludix-Launcher/issues
[license-shield]: https://img.shields.io/github/license/GaudiestBaker74/Ludix-Launcher.svg?style=for-the-badge
[license-url]: https://github.com/GaudiestBaker74/Ludix-Launcher/blob/master/LICENSE.txt
[product-screenshot]: images/screenshot.png
[Javascript]: https://shields.io/badge/JavaScript-F7DF1E?logo=JavaScript&logoColor=000&style=flat-square
[Javascript-url]: https://www.javascript.com/
