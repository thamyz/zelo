# Where everything lives

`script.js` was one 19,586-line file and `style.css` one 15,026-line sheet.
They were split, line for line, into `app/` and `css/`. **No code changed** —
only which file each part sits in.

## How it fits together

```
app/01-core.js  …  app/19-keyboard.js   ->  script.js   (what the app loads)
css/01-base.css …  css/14-later-….css   ->  style.css
```

`script.js` and `style.css` are **generated**. Edit the small files, then run:

```
bash scripts/sync.sh
```

That joins them, copies everything into `www/` and `ios/App/App/public/`,
deletes the `._*` junk this drive creates, and checks the copies match. If you
edit a generated file by hand, the build stops and tells you, instead of
quietly throwing your change away.

**Why join them instead of loading 33 files?** This code was written as one
script and depends on it: top-level data structures reference functions
declared further down (`CINE_STEPS` points at `cineRunIntroEntrance`). In one
file that works, because function declarations hoist to the top of their
script. As separate `<script>` tags it breaks. Joining gives the browser the
same single file it always had.

**The number in the filename is the load order.** `app/01-core.js` runs first.
Order matters: these files share one global scope, and in CSS a later file
overrides an earlier one.

## app/ — the JavaScript

| file | lines | what is in it |
|---|---:|---|
| `01-core.js` | 778 | app bootstrap, loaded first; everything below assumes it ran |
| `02-navigation.js` | 348 | moving between tabs and screens |
| `03-persona-profile.js` | 1130 | starting and leaving a practice chat, and her profile page |
| `04-chat-engine.js` | 1679 | the practice conversation itself: what she says and when |
| `05-chat-ui.js` | 970 | drawing the chat: bubbles, menus, banners |
| `06-swipe-deck.js` | 919 | the practice card deck |
| `07-practice-ui.js` | 900 | the first-run practice screens |
| `08-gestures.js` | 1119 | the shared gesture engine, used by most screens |
| `09-scan.js` | 1151 | Scan: from her message to a generated reply |
| `10-activity.js` | 424 | what counts as using Zelo, and the streak maths |
| `11-scan-ui.js` | 1174 | showing the generated replies |
| `12-onboarding-intro.js` | 1112 | the first thing a new user sees |
| `13-onboarding-steps.js` | 1273 | the onboarding questions and the screens after them |
| `14-chats-tab.js` | 597 | the Chats list |
| `15-history.js` | 1302 | Account, what the user has paid for, and saved scans |
| `16-ai-coach.js` | 1544 | AI Coach |
| `17-rewards.js` | 1070 | everything that rewards the user for coming back |
| `18-settings.js` | 1728 | Settings, and everything reachable from Account |
| `19-keyboard.js` | 626 | keeping the keyboard from breaking a layout |

Loaded alongside these and unchanged by the split: `config.js`, `data.js`,
`personas*.js` (the characters) and `services/` (Supabase, auth, analytics,
records, support, text guard).

## css/ — the stylesheet

| file | lines | what is in it |
|---|---:|---|
| `01-base.css` | 483 | resets, design tokens, the dark-mode palette, the tab/screen system, the shared app header and hero |
| `02-scan.css` | 1643 | the Scan page: input card, Generate button, and the generated-reply results |
| `03-screens.css` | 574 | the shared screen header, Profile, Tell Zelo More, and the Scan sub-pages |
| `04-chat.css` | 656 | the practice conversation screen, the chat-mode modal, the bottom tab bar and shared animations |
| `05-practice.css` | 975 | the Home brand heading, the swipe card deck, the match screen and the Chats list |
| `06-account.css` | 1578 | the Account dashboard, the older settings fields, and saved scan threads |
| `07-rewards.css` | 980 | Leaderboard, Your Journey, Mission Control and Milestones |
| `08-auth.css` | 793 | the sign-in, verification, password-reset and name/age overlays |
| `09-history.css` | 787 | the History screen and the AI Coach entry card on Scan |
| `10-paywall.css` | 359 | the trial explainer and paywall (presentation only - there is no payment code) |
| `11-ai-coach.css` | 1122 | the full AI Coach page, its chat history panel and the thread picker |
| `12-onboarding.css` | 1827 | the two-phase first-launch flow, every onboarding screen, and the practice tutorial |
| `13-settings.css` | 1721 | Settings 2.0, Refer Friends, Profile & Login, and the standard notification banner |
| `14-later-additions.css` | 1641 | rules added after the sheet was organised, which must stay last because they deliberately override earlier ones: the conversational intro, chat hold menu, persona profile, onboarding steps 7 and 13, blocked chat, retry bar, message banner and support forms |

## Finding a function

979 functions live in `app/`. Fastest way to find one:

```
grep -rn "function theName" app/
```

The 523 public ones (no leading underscore) and the file they are in:

| function | file |
|---|---|
| `abortPendingReply` | 05-chat-ui.js |
| `adjustTimingForWindow` | 15-history.js |
| `aiCoachAddInfo` | 16-ai-coach.js |
| `aiCoachAddPasteMessage` | 16-ai-coach.js |
| `aiCoachDismissStagedPill` | 16-ai-coach.js |
| `aiCoachHistoryDelete` | 16-ai-coach.js |
| `aiCoachHistoryNewChat` | 16-ai-coach.js |
| `aiCoachHistoryRename` | 16-ai-coach.js |
| `aiCoachHistoryRenameConfirm` | 16-ai-coach.js |
| `aiCoachHistorySelect` | 16-ai-coach.js |
| `aiCoachHistoryTogglePin` | 16-ai-coach.js |
| `aiCoachPromptTap` | 16-ai-coach.js |
| `aiCoachRemoveShot` | 16-ai-coach.js |
| `aiCoachShotSelected` | 16-ai-coach.js |
| `aiCoachStagePrompt` | 16-ai-coach.js |
| `aiCoachStatusSignIn` | 16-ai-coach.js |
| `aiCoachUploadScreenshot` | 16-ai-coach.js |
| `animateBackCards` | 06-swipe-deck.js |
| `appendAIBubble` | 05-chat-ui.js |
| `appendUserBubble` | 05-chat-ui.js |
| `appendUserBubbleStatic` | 14-chats-tab.js |
| `applyDarkIconSet` | 01-core.js |
| `applyTheme` | 01-core.js |
| `attachAiCoachChatSheetDragClose` | 03-persona-profile.js |
| `attachAiCoachHistoryDragClose` | 08-gestures.js |
| `attachAiCoachHistorySwipeOpen` | 08-gestures.js |
| `attachAiCoachRowActionsDragClose` | 08-gestures.js |
| `attachDragListeners` | 06-swipe-deck.js |
| `attachEdgeSwipeBack` | 08-gestures.js |
| `attachPracticeConfirmDragToClose` | 07-practice-ui.js |
| `attachProfileDetailDragToClose` | 08-gestures.js |
| `attachReplayBubbleHold` | 11-scan-ui.js |
| `attachTabSwipeGestures` | 08-gestures.js |
| `awardXP` | 17-rewards.js |
| `buildAccountExport` | 18-settings.js |
| `buildCardElement` | 06-swipe-deck.js |
| `buildScanContextBlock` | 09-scan.js |
| `cancelPendingReply` | 04-chat-engine.js |
| `chatBlockedDelete` | 04-chat-engine.js |
| `chatBlockedReset` | 04-chat-engine.js |
| `chatConfirmCancel` | 03-persona-profile.js |
| `chatConfirmProceed` | 03-persona-profile.js |
| `chatSearchClearAll` | 14-chats-tab.js |
| `chatSearchClearField` | 14-chats-tab.js |
| `chatSearchOpen` | 14-chats-tab.js |
| `chatSearchRemoveRecent` | 14-chats-tab.js |
| `chatSearchUseRecent` | 14-chats-tab.js |
| `chatSettingsDelete` | 03-persona-profile.js |
| `chatSettingsMuteToggle` | 03-persona-profile.js |
| `chatSettingsReport` | 03-persona-profile.js |
| `chatSettingsReset` | 03-persona-profile.js |
| `chatSettingsViewProfile` | 03-persona-profile.js |
| `checkGenerateReady` | 09-scan.js |
| `cineAdvanceSwipeQueue` | 13-onboarding-steps.js |
| `cineArmDragSmoothing` | 13-onboarding-steps.js |
| `cineArmSwipeHint` | 13-onboarding-steps.js |
| `cineAuthStub` | 13-onboarding-steps.js |
| `cineBack` | 12-onboarding-intro.js |
| `cineCommitDemoSwipe` | 13-onboarding-steps.js |
| `cineCommitIntro` | 13-onboarding-steps.js |
| `cineConvoBack` | 12-onboarding-intro.js |
| `cineConvoNameInput` | 12-onboarding-intro.js |
| `cineConvoNameKey` | 12-onboarding-intro.js |
| `cineConvoNameSubmit` | 12-onboarding-intro.js |
| `cineConvoPickAge` | 12-onboarding-intro.js |
| `cineConvoStart` | 12-onboarding-intro.js |
| `cineConvoTap` | 12-onboarding-intro.js |
| `cineConvoTeardown` | 12-onboarding-intro.js |
| `cineCurrentNameValue` | 13-onboarding-steps.js |
| `cineEnterAppAfterSignIn` | 12-onboarding-intro.js |
| `cineFinishOnboardingLanding` | 13-onboarding-steps.js |
| `cineFinishPhase2` | 13-onboarding-steps.js |
| `cineGoTo` | 12-onboarding-intro.js |
| `cineGoToShowcase` | 12-onboarding-intro.js |
| `cineHideOverlay` | 13-onboarding-steps.js |
| `cineIntroReady` | 13-onboarding-steps.js |
| `cineNameHasProfanity` | 13-onboarding-steps.js |
| `cineNameInput` | 13-onboarding-steps.js |
| `cineNameValid` | 13-onboarding-steps.js |
| `cineNext` | 12-onboarding-intro.js |
| `cineOfferClaim` | 13-onboarding-steps.js |
| `cineOfferClose` | 13-onboarding-steps.js |
| `cineOpenAgeSheet` | 13-onboarding-steps.js |
| `cinePaywallContinue` | 15-history.js |
| `cinePaywallDecline` | 15-history.js |
| `cinePhase1` | 12-onboarding-intro.js |
| `cinePhotoSelected` | 13-onboarding-steps.js |
| `cinePickMany` | 13-onboarding-steps.js |
| `cinePickOne` | 13-onboarding-steps.js |
| `cinePickPhoto` | 13-onboarding-steps.js |
| `cineProviderTap` | 13-onboarding-steps.js |
| `cineReferralApply` | 13-onboarding-steps.js |
| `cineReferralContinue` | 13-onboarding-steps.js |
| `cineRefreshIntroChecks` | 13-onboarding-steps.js |
| `cineRemovePhoto` | 13-onboarding-steps.js |
| `cineRenderAge` | 13-onboarding-steps.js |
| `cineRenderPhoto` | 13-onboarding-steps.js |
| `cineRequestNotifAndAdvance` | 12-onboarding-intro.js |
| `cineRestoreAnswers` | 13-onboarding-steps.js |
| `cineRunIntroEntrance` | 13-onboarding-steps.js |
| `cineRunPlanEntrance` | 13-onboarding-steps.js |
| `cineRunQuestionEntrance` | 12-onboarding-intro.js |
| `cineRunSetupEntrance` | 13-onboarding-steps.js |
| `cineRunStyleEntrance` | 13-onboarding-steps.js |
| `cineRunTrialVideoEntrance` | 13-onboarding-steps.js |
| `cineSelectTrialPlan` | 13-onboarding-steps.js |
| `cineSetChrome` | 12-onboarding-intro.js |
| `cineSetNextEnabled` | 12-onboarding-intro.js |
| `cineShowMatchContinuePrompt` | 13-onboarding-steps.js |
| `cineShowOffer` | 13-onboarding-steps.js |
| `cineShowTrialStart` | 13-onboarding-steps.js |
| `cineShowcaseSignIn` | 12-onboarding-intro.js |
| `cineShowcaseStart` | 12-onboarding-intro.js |
| `cineStylePick` | 13-onboarding-steps.js |
| `cineStylePickAgain` | 13-onboarding-steps.js |
| `cineSwipeQueueInit` | 13-onboarding-steps.js |
| `cineTrialStartContinue` | 13-onboarding-steps.js |
| `cineTrialStartDecline` | 13-onboarding-steps.js |
| `clearLocalChats` | 14-chats-tab.js |
| `clearScanInput` | 09-scan.js |
| `clearUploadedPhoto` | 09-scan.js |
| `closeAiCoach` | 16-ai-coach.js |
| `closeAiCoachChatSheet` | 03-persona-profile.js |
| `closeAiCoachRenamePrompt` | 16-ai-coach.js |
| `closeAiCoachRowActions` | 16-ai-coach.js |
| `closeBadgeDetail` | 17-rewards.js |
| `closeBadgeShare` | 17-rewards.js |
| `closeChatRowMenu` | 14-chats-tab.js |
| `closeChatSearch` | 14-chats-tab.js |
| `closeChatSettings` | 03-persona-profile.js |
| `closeHistory` | 15-history.js |
| `closeHistoryRenamePrompt` | 15-history.js |
| `closeHistoryRowActions` | 15-history.js |
| `closeJourney` | 17-rewards.js |
| `closeLeaderboardSettings` | 17-rewards.js |
| `closeLevelUpInfo` | 17-rewards.js |
| `closeMissionControl` | 17-rewards.js |
| `closeMsgMenu` | 05-chat-ui.js |
| `closePaywall` | 15-history.js |
| `closePersonaFeed` | 03-persona-profile.js |
| `closePersonaProfile` | 03-persona-profile.js |
| `closeProfileDetail` | 07-practice-ui.js |
| `closeReferFriends` | 17-rewards.js |
| `closeReplayToneSheet` | 11-scan-ui.js |
| `closeReportSheet` | 03-persona-profile.js |
| `closeSaveScanSheet` | 15-history.js |
| `closeThreadDetail` | 15-history.js |
| `closeThreadLinkPicker` | 16-ai-coach.js |
| `commitSwipe` | 06-swipe-deck.js |
| `confirmChatSettingsDelete` | 03-persona-profile.js |
| `confirmChatSettingsReset` | 03-persona-profile.js |
| `confirmDeleteAccount` | 18-settings.js |
| `confirmDeleteAllSkipped` | 18-settings.js |
| `confirmDeleteMatch` | 18-settings.js |
| `confirmDeleteSkippedProfile` | 18-settings.js |
| `confirmSaveScan` | 15-history.js |
| `copyCurrentReply` | 11-scan-ui.js |
| `copyReferralLink` | 17-rewards.js |
| `copyReplyFromCard` | 12-onboarding-intro.js |
| `copySheetText` | 17-rewards.js |
| `countWords` | 04-chat-engine.js |
| `createMsgAvatar` | 05-chat-ui.js |
| `cycleSettingsDifficulty` | 18-settings.js |
| `cycleSettingsTopics` | 18-settings.js |
| `ddBack` | 18-settings.js |
| `ddDone` | 18-settings.js |
| `ddDownloadNow` | 18-settings.js |
| `ddRequestData` | 18-settings.js |
| `ddShowStep` | 18-settings.js |
| `declineSaveScan` | 15-history.js |
| `decrementMatchSlots` | 15-history.js |
| `decrementScanCount` | 15-history.js |
| `deleteThread` | 15-history.js |
| `disableSwipeButtons` | 07-practice-ui.js |
| `doTypingAndReply` | 04-chat-engine.js |
| `enableSwipeButtons` | 07-practice-ui.js |
| `ensureTrialStarted` | 15-history.js |
| `exitChat` | 03-persona-profile.js |
| `exportAccountData` | 18-settings.js |
| `finishOnboardingNoPrompt` | 13-onboarding-steps.js |
| `flashLimitToast` | 15-history.js |
| `formatTime` | 15-history.js |
| `frDelete` | 18-settings.js |
| `frDetailBack` | 18-settings.js |
| `frEdit` | 18-settings.js |
| `frLoad` | 18-settings.js |
| `frNewInput` | 18-settings.js |
| `frSearchInput` | 18-settings.js |
| `frSetSort` | 18-settings.js |
| `frSubmitNew` | 18-settings.js |
| `frVote` | 18-settings.js |
| `frdInput` | 18-settings.js |
| `frdSendComment` | 18-settings.js |
| `freshAddMessage` | 11-scan-ui.js |
| `freshUseReply` | 12-onboarding-intro.js |
| `generateReplies` | 10-activity.js |
| `getCategoryBadges` | 17-rewards.js |
| `getCategoryUnlockedCount` | 17-rewards.js |
| `getDisplayName` | 17-rewards.js |
| `getEligibleStyles` | 09-scan.js |
| `getEntitlement` | 15-history.js |
| `getLbData` | 17-rewards.js |
| `getLevelForXP` | 17-rewards.js |
| `getLevelProgress` | 17-rewards.js |
| `getLinkedThread` | 16-ai-coach.js |
| `getLinkedThreadId` | 16-ai-coach.js |
| `getMilestoneCategory` | 17-rewards.js |
| `getMyLeaderboardEntry` | 17-rewards.js |
| `getReferralCode` | 17-rewards.js |
| `getThemePref` | 01-core.js |
| `getThreadCount` | 15-history.js |
| `getThreads` | 15-history.js |
| `getTierForLevel` | 17-rewards.js |
| `getTimeWindow` | 15-history.js |
| `getTotalUnlockedCount` | 17-rewards.js |
| `getXP` | 17-rewards.js |
| `gibConfirmEdit` | 09-scan.js |
| `gibConfirmProceed` | 09-scan.js |
| `gibReportFalsePositive` | 09-scan.js |
| `goBackFromResult` | 15-history.js |
| `goToStyleIndex` | 11-scan-ui.js |
| `handleAiCoachKeyDown` | 16-ai-coach.js |
| `handleChatModeOptionClick` | 03-persona-profile.js |
| `handleKeyDown` | 04-chat-engine.js |
| `handleUpload` | 09-scan.js |
| `hideAiCoachHowItWorks` | 16-ai-coach.js |
| `hideCopyToast` | 11-scan-ui.js |
| `hideLevelUpPanel` | 17-rewards.js |
| `hideMsgBanner` | 05-chat-ui.js |
| `hideStreakNotif` | 12-onboarding-intro.js |
| `hideTypingIndicator` | 05-chat-ui.js |
| `hideXPPanel` | 17-rewards.js |
| `historyRenameConfirm` | 15-history.js |
| `historyRowActionsDelete` | 15-history.js |
| `historyRowActionsRename` | 15-history.js |
| `historyTime` | 15-history.js |
| `homeModeSelect` | 13-onboarding-steps.js |
| `incrementMatchCount` | 15-history.js |
| `initChatsTab` | 14-chats-tab.js |
| `initMatchSlots` | 15-history.js |
| `initOnboarding` | 12-onboarding-intro.js |
| `initScanCountForToday` | 15-history.js |
| `initSilentGap` | 15-history.js |
| `initSwipeDeck` | 06-swipe-deck.js |
| `initTheme` | 01-core.js |
| `isBadgeUnlocked` | 17-rewards.js |
| `isDarkModeActive` | 01-core.js |
| `isInSilentGap` | 15-history.js |
| `isPaidUser` | 15-history.js |
| `isWithinTrial` | 15-history.js |
| `lbDisplayName` | 17-rewards.js |
| `lbPlayerNumber` | 17-rewards.js |
| `lbSettings` | 17-rewards.js |
| `linkThread` | 16-ai-coach.js |
| `loadChats` | 14-chats-tab.js |
| `lockedClose` | 15-history.js |
| `lockedContinue` | 15-history.js |
| `mailCancel` | 18-settings.js |
| `mailInput` | 18-settings.js |
| `mailOpenNative` | 18-settings.js |
| `mailSend` | 18-settings.js |
| `matchCount` | 15-history.js |
| `matchSlots` | 15-history.js |
| `maybeShowPracticeReviewModal` | 18-settings.js |
| `maybeShowReplyFeedback` | 18-settings.js |
| `maybeShowScanIntro` | 13-onboarding-steps.js |
| `maybeShowWelcomeBack` | 13-onboarding-steps.js |
| `milestoneArtSrc` | 17-rewards.js |
| `milestoneDigitsHTML` | 17-rewards.js |
| `missionGoToChatOrPractice` | 17-rewards.js |
| `missionGoToScan` | 17-rewards.js |
| `msUntil6am` | 15-history.js |
| `msgBannerOpen` | 05-chat-ui.js |
| `onAgeFilterSliderInput` | 18-settings.js |
| `onAsstInput` | 09-scan.js |
| `onChatSearchInput` | 14-chats-tab.js |
| `onDeleteChat` | 15-history.js |
| `onDragEnd` | 06-swipe-deck.js |
| `onDragMove` | 06-swipe-deck.js |
| `onDragStart` | 06-swipe-deck.js |
| `onLikeBtn` | 07-practice-ui.js |
| `onMessageBoxTap` | 09-scan.js |
| `onMessageInputChange` | 04-chat-engine.js |
| `onPracticeReviewToggle` | 18-settings.js |
| `onReplayAddInput` | 11-scan-ui.js |
| `onReplayAddKey` | 11-scan-ui.js |
| `onResultMessageCommit` | 09-scan.js |
| `onResultMessageInput` | 09-scan.js |
| `onResultScreenshot` | 09-scan.js |
| `onRetentionChange` | 18-settings.js |
| `onRewindBtn` | 07-practice-ui.js |
| `onSettingsToggle` | 18-settings.js |
| `onSkipBtn` | 07-practice-ui.js |
| `onStartChatting` | 09-scan.js |
| `openAiCoach` | 16-ai-coach.js |
| `openAiCoachFromChat` | 03-persona-profile.js |
| `openAiCoachFromScan` | 16-ai-coach.js |
| `openAiCoachRowActions` | 16-ai-coach.js |
| `openBadgeDetail` | 17-rewards.js |
| `openBadgeShare` | 17-rewards.js |
| `openChatFromStore` | 14-chats-tab.js |
| `openChatRowMenu` | 14-chats-tab.js |
| `openChatSearch` | 14-chats-tab.js |
| `openChatSettings` | 03-persona-profile.js |
| `openChatSettingsForRow` | 03-persona-profile.js |
| `openDashboard` | 15-history.js |
| `openDownloadData` | 18-settings.js |
| `openEmojiKeyboard` | 04-chat-engine.js |
| `openFeatureDetail` | 18-settings.js |
| `openFeatureNew` | 18-settings.js |
| `openFeatureRequests` | 18-settings.js |
| `openHelpSmarter` | 18-settings.js |
| `openHistory` | 15-history.js |
| `openHistoryRowActions` | 15-history.js |
| `openJourney` | 17-rewards.js |
| `openLeaderboard` | 17-rewards.js |
| `openLeaderboardSettings` | 17-rewards.js |
| `openLegalPage` | 18-settings.js |
| `openLevelUpInfo` | 17-rewards.js |
| `openMilestones` | 17-rewards.js |
| `openMissionControl` | 17-rewards.js |
| `openMsgMenu` | 05-chat-ui.js |
| `openPersonaPost` | 03-persona-profile.js |
| `openPersonaProfile` | 03-persona-profile.js |
| `openProfileDetail` | 07-practice-ui.js |
| `openReferFriends` | 17-rewards.js |
| `openReportSheet` | 03-persona-profile.js |
| `openScanReplay` | 15-history.js |
| `openScanUpload` | 09-scan.js |
| `openSettingsAgeRangeSub` | 18-settings.js |
| `openSettingsNotifications` | 18-settings.js |
| `openSettingsPersonalization` | 18-settings.js |
| `openSettingsPracticePrefs` | 18-settings.js |
| `openSettingsPrivacyData` | 18-settings.js |
| `openSettingsProfileLogin` | 18-settings.js |
| `openSettingsScanRetention` | 18-settings.js |
| `openSettingsSkippedProfiles` | 18-settings.js |
| `openSettingsWhoPractice` | 18-settings.js |
| `openSettingsZeloPro` | 15-history.js |
| `openStreakShare` | 17-rewards.js |
| `openSupport` | 18-settings.js |
| `openTellZelo` | 09-scan.js |
| `openThreadDetail` | 15-history.js |
| `openThreadLinkPicker` | 16-ai-coach.js |
| `pcBack` | 07-practice-ui.js |
| `pcTap` | 07-practice-ui.js |
| `pedCloseAttractedSheet` | 07-practice-ui.js |
| `pedCloseGenderSheet` | 07-practice-ui.js |
| `pedCloseNameSheet` | 07-practice-ui.js |
| `pedConfirmName` | 07-practice-ui.js |
| `pedOpenAttractedSheet` | 07-practice-ui.js |
| `pedOpenGenderSheet` | 07-practice-ui.js |
| `pedOpenNameSheet` | 07-practice-ui.js |
| `pedPhotoSelected` | 07-practice-ui.js |
| `pedPickAttracted` | 07-practice-ui.js |
| `pedPickGender` | 07-practice-ui.js |
| `pedPickPhoto` | 07-practice-ui.js |
| `pedRemovePhoto` | 07-practice-ui.js |
| `personaProfileMessage` | 03-persona-profile.js |
| `personaProfileTab` | 03-persona-profile.js |
| `plAddEmailCheckReqs` | 18-settings.js |
| `plCloseConnectEmailSheet` | 18-settings.js |
| `plCloseVerifyEmailModal` | 18-settings.js |
| `plConfirmEmailChange` | 18-settings.js |
| `plConnectEmailContinue` | 18-settings.js |
| `plCropCancel` | 18-settings.js |
| `plCropConfirm` | 18-settings.js |
| `plCropZoom` | 18-settings.js |
| `plEmailConnectedDone` | 18-settings.js |
| `plLinkEmailSubmit` | 18-settings.js |
| `plOpenForgotPassword` | 18-settings.js |
| `plPhotoSelected` | 18-settings.js |
| `plPickPhoto` | 18-settings.js |
| `plRemovePhoto` | 18-settings.js |
| `plResendEmailChangeCode` | 18-settings.js |
| `plSaveDisplayName` | 18-settings.js |
| `plSendPasswordReset` | 18-settings.js |
| `plSignOutAllDevices` | 18-settings.js |
| `plSigninRowTap` | 18-settings.js |
| `plToggleVisibility` | 18-settings.js |
| `playPaywallCheckmarkIntro` | 15-history.js |
| `playPaywallTimelineIntro` | 15-history.js |
| `playPaywallYearlyBouncePattern` | 15-history.js |
| `popScreen` | 02-navigation.js |
| `practiceCloseEditDetails` | 07-practice-ui.js |
| `practiceConfirmProfileContinue` | 07-practice-ui.js |
| `practiceOpenEditDetails` | 07-practice-ui.js |
| `practiceReviewChoose` | 18-settings.js |
| `practiceReviewOn` | 18-settings.js |
| `practiceSaveEditDetails` | 07-practice-ui.js |
| `practiceTutorialSkip` | 07-practice-ui.js |
| `practiceTutorialStart` | 07-practice-ui.js |
| `pruneExpiredScans` | 15-history.js |
| `pushScreen` | 02-navigation.js |
| `randBetween` | 15-history.js |
| `recordScan` | 15-history.js |
| `refreshAiCoachCard` | 16-ai-coach.js |
| `refreshScanLimitBanner` | 15-history.js |
| `refreshScanWhoCards` | 09-scan.js |
| `removeSeenStatus` | 05-chat-ui.js |
| `renderAiCoachChat` | 16-ai-coach.js |
| `renderAiCoachContext` | 16-ai-coach.js |
| `renderAiCoachHistoryPanel` | 16-ai-coach.js |
| `renderAiCoachSuggestPanel` | 16-ai-coach.js |
| `renderChatsList` | 14-chats-tab.js |
| `renderDailyMissions` | 17-rewards.js |
| `renderDeck` | 06-swipe-deck.js |
| `renderHerMessagePreview` | 09-scan.js |
| `renderHistory` | 15-history.js |
| `renderLeaderboard` | 17-rewards.js |
| `renderMilestonesHub` | 17-rewards.js |
| `renderMissionLevelCard` | 17-rewards.js |
| `renderPaywallPrices` | 13-onboarding-steps.js |
| `renderReplyCarousel` | 11-scan-ui.js |
| `renderTellZeloStep` | 09-scan.js |
| `renderThreadList` | 15-history.js |
| `replayAddCurrentMessage` | 11-scan-ui.js |
| `replayAddMessage` | 11-scan-ui.js |
| `replayChangeTone` | 11-scan-ui.js |
| `replayConfirmDeleteMessage` | 11-scan-ui.js |
| `replayDeleteMessage` | 11-scan-ui.js |
| `replayGetNewSuggestions` | 11-scan-ui.js |
| `replayPickTone` | 11-scan-ui.js |
| `replayUseReply` | 11-scan-ui.js |
| `replyFeedbackAnswer` | 18-settings.js |
| `requestHintsFor` | 03-persona-profile.js |
| `requestHintsFromComposer` | 04-chat-engine.js |
| `requestNotifPermission` | 13-onboarding-steps.js |
| `restorePurchasesFromPaywall` | 18-settings.js |
| `restoreSettingsPurchases` | 18-settings.js |
| `retentionDeleteCount` | 15-history.js |
| `retryAiCoachReply` | 16-ai-coach.js |
| `retryChatReply` | 04-chat-engine.js |
| `retryConnectivityCheck` | 01-core.js |
| `retryCrashScreen` | 01-core.js |
| `saveChats` | 14-chats-tab.js |
| `saveChatsNow` | 14-chats-tab.js |
| `saveDisplayName` | 17-rewards.js |
| `saveThreads` | 15-history.js |
| `scanContextString` | 09-scan.js |
| `scanQuickWho` | 09-scan.js |
| `scanWhoRemove` | 09-scan.js |
| `scansRemainingToday` | 15-history.js |
| `scheduleReply` | 04-chat-engine.js |
| `scheduleReplyFeedback` | 18-settings.js |
| `scrollAiCoachToBottom` | 16-ai-coach.js |
| `scrollToBottom` | 05-chat-ui.js |
| `selectChatMode` | 03-persona-profile.js |
| `selectPaywallPlan` | 15-history.js |
| `sendAiCoachMessage` | 16-ai-coach.js |
| `sendMessage` | 04-chat-engine.js |
| `setHeaderStatus` | 05-chat-ui.js |
| `setHistoryTab` | 15-history.js |
| `setLastMessageStatus` | 05-chat-ui.js |
| `setLbCategory` | 17-rewards.js |
| `setLbTimeFilter` | 17-rewards.js |
| `setLinkedThreadId` | 16-ai-coach.js |
| `setReplayAddWho` | 11-scan-ui.js |
| `setSendEnabled` | 05-chat-ui.js |
| `setThemePref` | 01-core.js |
| `setThreadCount` | 15-history.js |
| `setXP` | 17-rewards.js |
| `settingsAppearanceSelect` | 18-settings.js |
| `settingsHelpWithToggle` | 18-settings.js |
| `settingsPrefsAgeSelect` | 18-settings.js |
| `settingsPrefsMeSelect` | 18-settings.js |
| `settingsPrefsWhoSelect` | 18-settings.js |
| `settingsRetentionSelect` | 18-settings.js |
| `settingsToneSelect` | 18-settings.js |
| `shakeInputCard` | 09-scan.js |
| `shareReferral` | 17-rewards.js |
| `shareSheetInstagram` | 17-rewards.js |
| `shareSheetMessages` | 17-rewards.js |
| `shareSheetNatively` | 17-rewards.js |
| `showChatToast` | 05-chat-ui.js |
| `showCopyToast` | 11-scan-ui.js |
| `showDeleteConfirm` | 15-history.js |
| `showLevelUpPanel` | 17-rewards.js |
| `showLockedScreen` | 15-history.js |
| `showMatchOverlay` | 09-scan.js |
| `showMsgBanner` | 05-chat-ui.js |
| `showNotice` | 11-scan-ui.js |
| `showPaywallNow` | 15-history.js |
| `showReplyExplain` | 11-scan-ui.js |
| `showSaveBeforeLeave` | 15-history.js |
| `showSessionExpiredScreen` | 01-core.js |
| `showStreakNotif` | 12-onboarding-intro.js |
| `showTab` | 02-navigation.js |
| `showTypingIndicator` | 05-chat-ui.js |
| `showXPPanel` | 17-rewards.js |
| `shuffleArray` | 06-swipe-deck.js |
| `springBack` | 06-swipe-deck.js |
| `startChat` | 03-persona-profile.js |
| `startCineOnboarding` | 12-onboarding-intro.js |
| `startPracticeTutorial` | 07-practice-ui.js |
| `submitReport` | 03-persona-profile.js |
| `subscriptionExpired` | 15-history.js |
| `subscriptionGate` | 15-history.js |
| `syncChatToStore` | 14-chats-tab.js |
| `tellZeloBack` | 09-scan.js |
| `tellZeloNext` | 09-scan.js |
| `tellZeloSelect` | 09-scan.js |
| `tellzeloAnswersString` | 09-scan.js |
| `todayKey` | 15-history.js |
| `toggleAiCoachHistoryPanel` | 16-ai-coach.js |
| `toggleAiCoachSuggestPanel` | 16-ai-coach.js |
| `toggleLbSetting` | 17-rewards.js |
| `toggleReplayAddBox` | 11-scan-ui.js |
| `toggleSettingsFaq` | 18-settings.js |
| `triggerPaywallYearlyBounce` | 15-history.js |
| `triggerResultUpload` | 09-scan.js |
| `triggerUpload` | 09-scan.js |
| `truncateToWordLimit` | 04-chat-engine.js |
| `unskipProfile` | 18-settings.js |
| `updateChatModeOptionUI` | 03-persona-profile.js |
| `updateScanMessagePreview` | 09-scan.js |
| `updateTabGlassPill` | 02-navigation.js |
| `updateTellZeloSummary` | 09-scan.js |
| `upgradeNow` | 15-history.js |
| `watchForNewIcons` | 01-core.js |
| `widgetCarouselGoTo` | 11-scan-ui.js |
| `widgetCarouselNext` | 11-scan-ui.js |
| `widgetCarouselPrev` | 11-scan-ui.js |
