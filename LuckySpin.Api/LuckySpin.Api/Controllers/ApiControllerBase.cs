using LuckySpin.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LuckySpin.Api.Controllers;

public abstract class ApiControllerBase : ControllerBase
{
    protected bool TryGetAccount(out PlayerAccount account)
    {
        var token = Request.Headers.Authorization.ToString();
        token = token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? token[7..].Trim() : token.Trim();
        return GameStore.TryGetAccount(token, out account);
    }

    protected IActionResult UnauthorizedResponse() => Unauthorized(new { message = "Your session is missing or expired." });
}
