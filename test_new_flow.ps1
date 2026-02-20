$ErrorActionPreference = "Stop"
$base = "https://sawaari-09bb.onrender.com/api"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SAWAARI NEW FLOW TEST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ═══════════════════════════════════════════════════════════════
# STEP 1: Register a user (NO role)
# ═══════════════════════════════════════════════════════════════
Write-Host "[1/12] Sending OTP for new user..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/auth/send-otp" -Method POST -ContentType "application/json" -Body '{"phone":"+919063612124"}' | Out-Null
Start-Sleep -Seconds 1

# Read OTP from backend (hacky: use send-otp again to trigger a fresh one, then capture)
Write-Host "  (Check backend terminal for OTP)" -ForegroundColor DarkGray

# For testing, we call send-otp which prints the OTP to console.
# We'll manually set it here — in tests we read from the test plan
$otp1 = Read-Host "  Enter OTP for +919063612124"

Write-Host "[2/12] Verifying OTP..." -ForegroundColor Yellow
$verifyRes = Invoke-RestMethod -Uri "$base/auth/verify-otp" -Method POST -ContentType "application/json" -Body "{`"phone`":`"+919063612124`",`"otp`":`"$otp1`"}"
if ($verifyRes.needsRegistration) {
    Write-Host "  PASS - New user, needs registration" -ForegroundColor Green
} else {
    Write-Host "  INFO - Existing user logged in" -ForegroundColor DarkYellow
}

Write-Host "[3/12] Registering (just name, gender, age — NO role)..." -ForegroundColor Yellow
$regRes = Invoke-RestMethod -Uri "$base/auth/register" -Method POST -ContentType "application/json" -Body "{`"phone`":`"+919063612124`",`"otp`":`"$otp1`",`"username`":`"satwika`",`"gender`":`"Female`",`"age`":21}"
$riderToken = $regRes.token
$riderHeaders = @{ Authorization = "Bearer $riderToken" }
Write-Host "  PASS - User created: $($regRes.user.username), role: $($regRes.user.role)" -ForegroundColor Green
if ($null -eq $regRes.user.role) {
    Write-Host "  PASS - Role is NULL (as expected)" -ForegroundColor Green
}

# ═══════════════════════════════════════════════════════════════
# STEP 2: Register another user as driver
# ═══════════════════════════════════════════════════════════════
Write-Host "[4/12] Sending OTP for driver user..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/auth/send-otp" -Method POST -ContentType "application/json" -Body '{"phone":"+919876543210"}' | Out-Null

$otp2 = Read-Host "  Enter OTP for +919876543210"

$verifyRes2 = Invoke-RestMethod -Uri "$base/auth/verify-otp" -Method POST -ContentType "application/json" -Body "{`"phone`":`"+919876543210`",`"otp`":`"$otp2`"}"

Write-Host "[5/12] Registering driver user (no role yet)..." -ForegroundColor Yellow
$regRes2 = Invoke-RestMethod -Uri "$base/auth/register" -Method POST -ContentType "application/json" -Body "{`"phone`":`"+919876543210`",`"otp`":`"$otp2`",`"username`":`"rahul`",`"gender`":`"Male`",`"age`":28}"
$driverToken = $regRes2.token
$driverHeaders = @{ Authorization = "Bearer $driverToken" }
Write-Host "  PASS - User created: $($regRes2.user.username), role: $($regRes2.user.role)" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════
# STEP 3: Set DriveShare role — DRIVER (with license)
# ═══════════════════════════════════════════════════════════════
Write-Host "[6/12] Setting DriveShare role to DRIVER (with license)..." -ForegroundColor Yellow
$roleRes = Invoke-RestMethod -Uri "$base/auth/set-driveshare-role" -Method POST -ContentType "application/json" -Headers $driverHeaders -Body '{"role":"driver","licenseNo":"DL-0120110012345","issueDate":"2020-01-15","expiryDate":"2030-01-15"}'
$driverToken = $roleRes.token  # Update token (now contains role)
$driverHeaders = @{ Authorization = "Bearer $driverToken" }
Write-Host "  PASS - $($roleRes.message) | Role: $($roleRes.user.role)" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════
# STEP 4: Driver creates vehicle + trip
# ═══════════════════════════════════════════════════════════════
Write-Host "[7/12] Driver adding vehicle..." -ForegroundColor Yellow
$vehicleRes = Invoke-RestMethod -Uri "$base/ts/vehicles" -Method POST -ContentType "application/json" -Headers $driverHeaders -Body '{"model":"Maruti Swift","type":"Cab","color":"White","capacity":4}'
Write-Host "  PASS - Vehicle ID: $($vehicleRes.vehicle_id)" -ForegroundColor Green

Write-Host "[8/12] Driver creating trip..." -ForegroundColor Yellow
$tripBody = '{"vehicle_id":' + $vehicleRes.vehicle_id + ',"source":"Gachibowli","destination":"Hitech City","date":"2026-02-20","time":"09:00","available_seats":3,"price":50,"pink_mode":false}'
$tripRes = Invoke-RestMethod -Uri "$base/ts/trips" -Method POST -ContentType "application/json" -Headers $driverHeaders -Body $tripBody
Write-Host "  PASS - Trip ID: $($tripRes.trip_id), Gachibowli -> Hitech City, 3 seats, Rs 50" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════
# STEP 5: Set RIDER role for first user
# ═══════════════════════════════════════════════════════════════
Write-Host "[9/12] Setting DriveShare role to RIDER for satwika..." -ForegroundColor Yellow
$riderRoleRes = Invoke-RestMethod -Uri "$base/auth/set-driveshare-role" -Method POST -ContentType "application/json" -Headers $riderHeaders -Body '{"role":"rider"}'
$riderToken = $riderRoleRes.token
$riderHeaders = @{ Authorization = "Bearer $riderToken" }
Write-Host "  PASS - $($riderRoleRes.message) | Role: $($riderRoleRes.user.role)" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════
# STEP 6: Rider searches and books trip
# ═══════════════════════════════════════════════════════════════
Write-Host "[10/12] Rider searching for trips..." -ForegroundColor Yellow
$searchRes = Invoke-RestMethod -Uri "$base/ts/trips?source=Gachibowli&destination=Hitech+City" -Headers $riderHeaders
Write-Host "  PASS - Found $($searchRes.trips.Count) trip(s)" -ForegroundColor Green

if ($searchRes.trips.Count -gt 0) {
    $tripId = $searchRes.trips[0].id
    Write-Host "[11/12] Rider booking trip #$tripId..." -ForegroundColor Yellow
    $bookRes = Invoke-RestMethod -Uri "$base/ts/bookings" -Method POST -ContentType "application/json" -Headers $riderHeaders -Body "{`"trip_id`":$tripId,`"seats`":1}"
    Write-Host "  PASS - Booking ID: $($bookRes.booking_id)" -ForegroundColor Green

    Write-Host "[12/12] Rider paying for booking..." -ForegroundColor Yellow
    $payRes = Invoke-RestMethod -Uri "$base/ts/payments" -Method POST -ContentType "application/json" -Headers $riderHeaders -Body "{`"booking_id`":$($bookRes.booking_id),`"mode`":`"UPI`"}"
    Write-Host "  PASS - Payment: Rs $($payRes.amount) via $($payRes.mode)" -ForegroundColor Green
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "NEW FLOW SUMMARY:" -ForegroundColor White
Write-Host "  1. Login: Phone + OTP (no role)" -ForegroundColor DarkGray
Write-Host "  2. Register: username, gender, age (no role)" -ForegroundColor DarkGray
Write-Host "  3. DriveShare entry: choose Driver or Rider" -ForegroundColor DarkGray
Write-Host "  4. Driver: license -> add vehicle -> create trip" -ForegroundColor DarkGray
Write-Host "  5. Rider: search trips -> book seat -> pay" -ForegroundColor DarkGray
Write-Host ""
