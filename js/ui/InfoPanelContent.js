const INFO_HOW_TO_PLAY_LINK = `<button class="panel-link" data-action="how-to-play">How to Play</button>`;

const LEGAL_NOTICE_BODY = `
    <h3>Legal Notice</h3>
    <p>Information according to § 5 DDG (German Digital Services Act)</p>
    <p>
        Angelo Pietsch<br>
        Haydnstraße 45<br>
        02709 Löbau<br>
        Sachsen, Germany
    </p>
    <p><strong>Contact:</strong><br>
        Email: apietsch94@gmail.com
    </p>
    <p><strong>Responsible for content according to § 18 (2) MStV:</strong><br>
        Angelo Pietsch, address as above
    </p>
`;

const PRIVACY_POLICY_BODY = `
    <h3>Privacy Policy</h3>
    <p><strong>1. Controller</strong><br>
        Angelo Pietsch<br>
        Haydnstraße 45, 02709 Löbau, Germany<br>
        apietsch94@gmail.com
    </p>
    <p><strong>2. No data collection by the game</strong><br>
        CHROMATIC does not process any personal data. There is no account
        system, no tracking, no cookies, and no server-side data processing.
    </p>
    <p><strong>3. Save data</strong><br>
        Your game progress is stored exclusively in your browser's
        LocalStorage. This data never leaves your device and is not
        transmitted to us or any third party.
    </p>
    <p><strong>4. Hosting</strong><br>
        This site is hosted via GitHub Pages (GitHub, Inc., 88 Colin P.
        Kelly Jr. Street, San Francisco, CA 94107, USA). When accessing the
        site, GitHub automatically processes technical access data (e.g. IP
        address, browser type, access time) in server log files. This is
        outside our control. Details:
        <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub's Privacy Statement</a>.
    </p>
    <p><strong>5. Your rights</strong><br>
        Since no personal data is stored by us, access, deletion, and
        objection rights against us are effectively not applicable in
        practice. For questions, contact: apietsch94@gmail.com
    </p>
`;

/**
 * @param {{title:string,url:string,author:string,authorUrl:string,license:string,licenseUrl:string}} credit
 * @returns {string}
 */
function buildFreesoundCreditRow(credit) {
    return `
        <a href="${credit.url}" target="_blank" rel="noopener noreferrer">${credit.title}</a>
        by <a href="${credit.authorUrl}" target="_blank" rel="noopener noreferrer">${credit.author}</a>
        (<a href="${credit.licenseUrl}" target="_blank" rel="noopener noreferrer">${credit.license}</a>)<br>
    `;
}

/**
 * @param {{name:string,detail:string,links:{label:string,url:string}[],license:string|null,licenseUrl:string|null,licenseNote:string}} entry
 * @returns {string}
 */
function buildThirdPartyRow(entry) {
    const links = entry.links.map((link) => `<a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a>`).join(', ');
    const licenseLine = entry.license
        ? `License: <a href="${entry.licenseUrl}" target="_blank" rel="noopener noreferrer">${entry.license}</a> - ${entry.licenseNote}`
        : entry.licenseNote;
    return `<p>${entry.name} - ${entry.detail} (${links}). ${licenseLine}</p>`;
}

/**
 * Builds the Credits section entirely from assets/credits.json (the single
 * place this data is maintained) - AI-generation disclosure (art/music/
 * code), tools, third-party assets and their exact licenses, and every
 * Freesound clip used.
 * @param {object} credits - assets/credits.json, already loaded (AssetLoader).
 * @returns {string}
 */
function buildCreditsBody(credits) {
    const toolsList = credits.tools.join('<br>');
    const thirdPartyRows = credits.thirdParty.map(buildThirdPartyRow).join('');
    const freesoundRows = credits.freesound.map(buildFreesoundCreditRow).join('');

    return `
        <h3>Credits</h3>
        <p><strong>Artwork:</strong> ${credits.aiGenerated.artwork}</p>
        <p><strong>Music:</strong> ${credits.aiGenerated.music}</p>
        <p><strong>Code:</strong> ${credits.aiGenerated.code}</p>

        <h4>Tools</h4>
        <p>${toolsList}</p>

        <h4>Third-Party Assets</h4>
        ${thirdPartyRows}

        <h4>Audio (Freesound.org)</h4>
        <p>${freesoundRows}</p>
    `;
}

/**
 * Full Info panel body - How to Play entry point, Credits, Legal Notice,
 * Privacy Policy, in that order.
 * @param {AssetLoader} assets - For assets/credits.json (already loaded by LoadingState.js).
 * @returns {string}
 */
export function buildInfoBody(assets) {
    const credits = assets.getJSON('credits');
    return INFO_HOW_TO_PLAY_LINK + buildCreditsBody(credits) + LEGAL_NOTICE_BODY + PRIVACY_POLICY_BODY;
}
