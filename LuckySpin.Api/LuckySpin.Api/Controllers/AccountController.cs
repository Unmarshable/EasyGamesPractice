using LuckySpin.Api.Models;
using LuckySpin.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LuckySpin.Api.Controllers;

[ApiController]
[Route("api/account")]
public sealed class AccountController : ApiControllerBase
{
    [HttpGet]
    public IActionResult GetAccount()
    {
        return TryGetAccount(out var account) ? Ok(GameStore.Snapshot(account)) : UnauthorizedResponse();
    }

    [HttpGet("profile")]
    public IActionResult GetProfile()
    {
        return TryGetAccount(out var account) ? Ok(GameStore.Profile(account)) : UnauthorizedResponse();
    }

    [HttpPut("profile")]
    public IActionResult UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        if (!TryGetAccount(out var account)) return UnauthorizedResponse();
        return GameStore.TryUpdateProfile(request, account, out var profile, out var error)
            ? Ok(profile)
            : BadRequest(new ApiError { Message = error });
    }

    [HttpPost("password")]
    public IActionResult ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (!TryGetAccount(out var account)) return UnauthorizedResponse();
        return GameStore.TryChangePassword(request, account, out var error)
            ? NoContent()
            : BadRequest(new ApiError { Message = error });
    }
}
