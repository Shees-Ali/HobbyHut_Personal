.PHONY: init_fastlane
init_fastlane: 
	@echo "🚀 Initialising Fastlane"
	@cd ios/App; fastlane init

.PHONY: init_match
init_match:
	@echo "✍🏽 Initialising match"
	@cd ios/App; fastlane match init

.PHONY: build_app
build_app:
	@echo "📦 Building Ionic app"
	npm run build -- --prod

.PHONY: sync_capacitor
sync_capacitor:
	@echo "🔄 Running capacitor sync"
	npx cap sync ios

.PHONY: deploy_testflight
deploy_testflight: build_app sync_capacitor
	@echo "🍎 Deploying to testflight"
	@cd ios/App; fastlane beta

.PHONY: start_server
start_server:
	@echo "☄️  Starting server"
	npm run start