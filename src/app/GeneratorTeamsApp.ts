// Copyright (c) Wictor Wilén. All rights reserved. 
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as Generator from 'yeoman-generator';
import * as lodash from 'lodash';
import * as chalk from 'chalk';
import { GeneratorTeamsAppOptions } from './GeneratorTeamsAppOptions';
import { Yotilities } from './Yotilities';
import * as AppInsights from 'applicationinsights';

let yosay = require('yosay');
let path = require('path');
let pkg = require('../../package.json');
let Guid = require('guid');

/**
 * The main implementation for the `teams` generator
 */
export class GeneratorTeamsApp extends Generator {
    options: GeneratorTeamsAppOptions = new GeneratorTeamsAppOptions();

    public constructor(args: any, opts: any) {
        super(args, (!(opts.force = true)) || opts);
        opts.force = true;
        this.desc('Generate a Microsoft Teams application.');
        this.argument('solutionName', {
            description: 'Solution name, as well as folder name',
            required: false
        });
        this.option('skip-install', {
            type: Boolean,
            default: false,
            description: 'Skips running npm install'
        });
        AppInsights.setup('6d773b93-ff70-45c5-907c-8edae9bf90eb');
        delete AppInsights.defaultClient.context.tags['ai.cloud.roleInstance'];
        AppInsights.Configuration.setAutoCollectExceptions(true);
        AppInsights.Configuration.setAutoCollectPerformance(true);
        AppInsights.defaultClient.commonProperties = {
            version: pkg.version
        };
        AppInsights.defaultClient.trackEvent({ name: 'start-generator' });
        this.options.existingManifest = this.fs.readJSON(`./src/manifest/manifest.json`);
    }

    public initializing() {
        this.log(yosay('Welcome to the ' + chalk.default.yellow(`Microsoft Teams App generator :) (${pkg.version})`)));
        this.composeWith('teams:tab', { 'options': this.options });
        this.composeWith('teams:bot', { 'options': this.options });
        this.composeWith('teams:custombot', { 'options': this.options });
        this.composeWith('teams:connector', { 'options': this.options });
        this.composeWith('teams:messageExtension', { 'options': this.options });

        // check schema version:
        if (this.options.existingManifest) {
            if (this.options.existingManifest["$schema"] != 'https://statics.teams.microsoft.com/sdk/v1.2/manifest/MicrosoftTeams.schema.json') {
                this.log(chalk.default.red('You are running the generator on an already existing project, but on a non supported-schema.'));
                process.exit(1);
            }
        }
    }

    public prompting() {
        return this.prompt(
            [
                {
                    type: 'confirm',
                    name: 'confirmedAdd',
                    default: false,
                    message: `You are running the generator on an already existing project, "${this.options.existingManifest && this.options.existingManifest.name.short}", are you sure you want to continue?`,
                    when: () => this.options.existingManifest,
                },
                {
                    type: 'input',
                    name: 'solutionName',
                    default: lodash.kebabCase(this.appname),
                    when: () => !(this.options.solutionName || this.options.existingManifest),
                    message: 'What is your solution name?'
                },
                {
                    type: 'list',
                    name: 'whichFolder',
                    default: 'current',
                    when: () => !(this.options.solutionName || this.options.existingManifest),
                    message: 'Where do you want to place the files?',
                    choices: [
                        {
                            name: 'Use the current folder',
                            value: 'current'
                        },
                        {
                            name: 'Create a subfolder with solution name',
                            value: 'subdir'
                        }
                    ]
                },
                {
                    type: 'input',
                    name: 'name',
                    message: 'Title of your Microsoft Teams App project?',
                    when: () => !this.options.existingManifest,
                    default: this.appname
                },
                {
                    type: 'input',
                    name: 'developer',
                    message: 'Your (company) name? (max 32 characters)',
                    default: this.user.git.name,
                    validate: (input: string) => {
                        return input.length > 0 && input.length <= 32;
                    },
                    when: () => !this.options.existingManifest,
                    store: true
                },
                {
                    type: 'checkbox',
                    message: 'What do you want to add to your project?',
                    name: 'parts',
                    choices: [
                        {
                            name: 'A Tab',
                            value: 'tab',
                            checked: true
                        },
                        {
                            name: 'A Bot',
                            value: 'bot'
                        },
                        {
                            name: 'An Outgoing Webhook',
                            value: 'custombot'
                        },
                        {
                            name: 'A Connector',
                            value: 'connector'
                        },
                        {
                            name: 'A Message Extension',
                            value: 'messageextension',
                        }
                    ],
                    when: (answers) => answers.confirmedAdd != false
                },
                {
                    type: 'input',
                    name: 'host',
                    message: 'The URL where you will host this solution?',
                    default: (answers: any) => {
                        return `https://${lodash.camelCase(answers.solutionName)}.azurewebsites.net`;
                    },
                    validate: Yotilities.validateUrl,
                    when: () => !this.options.existingManifest,
                },
            ]
        ).then((answers: any) => {
            if (answers.confirmedAdd == false) {
                process.exit(0)
            }
            if (!this.options.existingManifest) {
                answers.host = answers.host.endsWith('/') ? answers.host.substr(0, answers.host.length - 1) : answers.host;
                this.options.title = answers.name;
                this.options.description = this.description;
                this.options.solutionName = this.options.solutionName || answers.solutionName;
                this.options.shouldUseSubDir = answers.whichFolder === 'subdir';
                this.options.libraryName = lodash.camelCase(this.options.solutionName);
                this.options.packageName = this.options.libraryName.toLocaleLowerCase();
                this.options.developer = answers.developer;
                this.options.host = answers.host;
                var tmp: string = this.options.host.substring(this.options.host.indexOf('://') + 3)
                var arr: string[] = tmp.split('.');
                this.options.namespace = lodash.reverse(arr).join('.');
                this.options.tou = answers.host + '/tou.html';
                this.options.privacy = answers.host + '/privacy.html';
                this.options.id = Guid.raw();
                if (this.options.host.indexOf('azurewebsites.net') >= 0) {
                    this.options.websitePrefix = this.options.host.substring(this.options.host.indexOf('://') + 3, this.options.host.indexOf('.'));
                } else {
                    this.options.websitePrefix = '[your Azure web app name]';
                }

                if (this.options.shouldUseSubDir) {
                    this.destinationRoot(this.destinationPath(this.options.solutionName));
                }
            } else {
                this.options.developer = this.options.existingManifest.developer.name;
                this.options.title = this.options.existingManifest.name.short;
                let pkg = this.fs.readJSON(`./package.json`);
                this.options.libraryName = pkg.name;
                this.options.host = this.options.existingManifest.developer.websiteUrl;
            }

            this.options.bot = (<string[]>answers.parts).indexOf('bot') != -1;
            this.options.tab = (<string[]>answers.parts).indexOf('tab') != -1;
            this.options.connector = (<string[]>answers.parts).indexOf('connector') != -1;
            this.options.customBot = (<string[]>answers.parts).indexOf('custombot') != -1;
            this.options.messageExtension = (<string[]>answers.parts).indexOf('messageextension') != -1;

            this.options.reactComponents = false; // set to false initially

        });
    }

    public configuring() {

    }

    public default() {

    }

    public writing() {
        if (!this.options.existingManifest) {
            let staticFiles = [
                "_gitignore",
                "tsconfig.json",
                "tsconfig-client.json",
                "src/manifest/icon-outline.png",
                "src/manifest/icon-color.png",
                "src/app/web/assets/icon.png",
                'deploy.cmd',
                '_deployment',
                "src/app/TeamsAppsComponents.ts"
            ]
            

            let templateFiles = [
                "README.md",
                "gulpfile.js",
                "package.json",
                ".env",
                'src/app/server.ts',
                "src/manifest/manifest.json",
                "webpack.config.js",
                "src/app/scripts/client.ts",
                "src/app/web/index.html",
                "src/app/web/tou.html",
                "src/app/web/privacy.html",
            ];

            this.sourceRoot()

            templateFiles.forEach(t => {
                this.fs.copyTpl(
                    this.templatePath(t),
                    Yotilities.fixFileNames(t, this.options),
                    this.options);
            });
            staticFiles.forEach(t => {
                this.fs.copy(
                    this.templatePath(t),
                    Yotilities.fixFileNames(t, this.options));
            });

            // if we have added any react based components
            if (this.options.reactComponents) {
                Yotilities.addAdditionalDeps([
                    ["msteams-react-base-component", "~1.0.0"]
                ], this.fs);
            }
        }
    }

    public conflicts() {

    }

    public install() {
        // track usage
        if (this.options.existingManifest) {
            AppInsights.defaultClient.trackEvent({ name: 'rerun-generator' });
        }
        AppInsights.defaultClient.trackEvent({ name: 'end-generator' });
        if (this.options.bot) {
            AppInsights.defaultClient.trackEvent({ name: 'bot' });
            if (this.options.botType == 'existing') {
                AppInsights.defaultClient.trackEvent({ name: 'bot-existing' });
            } else {
                AppInsights.defaultClient.trackEvent({ name: 'bot-new' });
            }
        }
        if (this.options.messageExtension) {
            AppInsights.defaultClient.trackEvent({ name: 'messageExtension' });
        }
        if (this.options.connector) {
            AppInsights.defaultClient.trackEvent({ name: 'connector' });
        }
        if (this.options.customBot) {
            AppInsights.defaultClient.trackEvent({ name: 'outgoingWebhook' });
        }
        if (this.options.staticTab) {
            AppInsights.defaultClient.trackEvent({ name: 'staticTab' });
        }
        if (this.options.tab) {
            AppInsights.defaultClient.trackEvent({ name: 'tab' });
        }
        AppInsights.defaultClient.flush();

        if (this.options['skip-install']) {
            this.log(chalk.default.yellow('Skipping installation of dependencies. You should run "npm install"'));
        } else {
            this.npmInstall();
        }
    }

    public end() {
        this.log(chalk.default.yellow('Thanks for using the generator!'));
        this.log(chalk.default.yellow('Have fun and make great Microsoft Teams Apps...'));
    }
}