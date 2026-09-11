using LuckySpin.Api.Models;
using LuckySpin.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LuckySpin.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ApiControllerBase
{
    [HttpPost("register")]
    public IActionResult Register([FromBody] AuthRequest request)
    {
        return GameStore.TryRegister(request, out var response, out var error)
            ? Ok(response)
            : BadRequest(new ApiError { Message = error });
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] AuthRequest request)
    {
        return GameStore.TryLogin(request, out var response, out var error)
            ? Ok(response)
            : Unauthorized(new ApiError { Message = error });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var token = Request.Headers.Authorization.ToString().Replace("Bearer ", "", StringComparison.OrdinalIgnoreCase).Trim();
        GameStore.SignOut(token);
        return NoContent();
    }
}
