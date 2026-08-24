@echo off
echo Installing react-router-dom...
npm install react-router-dom@7.1.1 --save --legacy-peer-deps
echo.
echo Verifying installation...
npm list react-router-dom --depth=0
echo.
echo Listing node_modules\react-router-dom...
dir node_modules\react-router-dom
echo.
echo Done!
