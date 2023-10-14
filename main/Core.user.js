// ==UserScript==
// @name         [Ultra-Testing]
// @namespace    http://tampermonkey.net/
// @version      no
// @description  Shows full list of company extensions
// @author       You
// @match        https://ubox.uhaul.net/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=uhaul.net
// @grant        none
// ==/UserScript==

const Redirects = [
    "autoUbxEmail",
];

(async function() {
    'use strict';
    const UpdateVal = 1;
    const now = new Date();
    const minutes = Math.floor(now.getMinutes() / UpdateVal) * UpdateVal;
    const timeString = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + ':' + minutes;
    const githubURL = `https://raw.githubusercontent.com/SillyMeTimbers/WorkspaceUbox/main/`;

    for (const redirect of Redirects) {
        const url = `${githubURL}${redirect}.user.js?time=${timeString}`;

        try {
            const response = await fetch(url);

            if (response.ok) {
                const scriptText = await response.text();
                const script = document.createElement('script');
                script.textContent = scriptText;
                document.head.appendChild(script);
            } else {
                console.log(`Failed to fetch script: ${redirect}`);
            }
        } catch (error) {
            console.log(`An error occurred while fetching script: ${redirect}`);
            console.error(error);
        }
    }
})();
